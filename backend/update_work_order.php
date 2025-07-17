<?php
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor', 'Engineer', 'Technician']);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid Work Order ID."]);
    exit();
}

// Use a transaction to ensure all database changes succeed or none do.
$conn->begin_transaction();

try {
    // Block 1: Handle part consumption if the status is changing to 'Completed'.
    if (isset($data->status) && $data->status === 'Completed') {
        $stmt_get_parts = $conn->prepare("SELECT requiredParts FROM workorders WHERE id = ?");
        $stmt_get_parts->bind_param("i", $id);
        $stmt_get_parts->execute();
        $wo_result = $stmt_get_parts->get_result()->fetch_assoc();
        $stmt_get_parts->close();
        
        $requiredParts = isset($wo_result['requiredParts']) ? json_decode($wo_result['requiredParts'], true) : [];

        if (!empty($requiredParts) && is_array($requiredParts)) {
            $log_details_parts = "Consumed parts for WO #$id: ";
            $details_array = [];
            
            foreach ($requiredParts as $part) {
                if (!isset($part['partId']) || !isset($part['quantity'])) continue;
                
                $partId = intval($part['partId']);
                $qty_to_deduct = intval($part['quantity']);

                $stmt_update_part = $conn->prepare("UPDATE parts SET quantity = quantity - ? WHERE id = ? AND quantity >= ?");
                $stmt_update_part->bind_param("iii", $qty_to_deduct, $partId, $qty_to_deduct);
                $stmt_update_part->execute();
                
                if ($stmt_update_part->affected_rows === 0) {
                    throw new Exception("Not enough stock for Part ID: $partId, or part not found.");
                }
                $stmt_update_part->close();
                $details_array[] = "$qty_to_deduct x PartID $partId";
            }
            
            if (!empty($details_array)) {
                $log_user = $_SESSION['user_fullname'];
                $log_details_parts .= implode(', ', $details_array) . ".";
                $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Parts Consumed', ?)");
                $log_stmt->bind_param("ss", $log_user, $log_details_parts);
                $log_stmt->execute();
                $log_stmt->close();
            }
        }
    }

    // Block 2: Update the work order itself with the data from the frontend.
    $checklistJson = json_encode($data->checklist);
    $requiredPartsJson = json_encode($data->requiredParts);
    $data->wo_type = $data->wo_type ?? 'CM';

    $stmt_update_wo = $conn->prepare(
        "UPDATE workorders SET title=?, description=?, assetId=?, assignedTo=?, task=?, start_date=?, dueDate=?, priority=?, frequency=?, status=?, 
        breakdownTimestamp=?, checklist=?, requiredParts=?, completionNotes=?, completedDate=?, wo_type=? WHERE id=?"
    );
    $stmt_update_wo->bind_param("ssiissssssssssssi", 
        $data->title, $data->description, $data->assetId, $data->assignedTo, 
        $data->task, $data->start_date, $data->dueDate, $data->priority, $data->frequency, 
        $data->status, $data->breakdownTimestamp, $checklistJson, 
        $requiredPartsJson, $data->completionNotes, $data->completedDate, 
        $data->wo_type,
        $id
    );
    
    if (!$stmt_update_wo->execute()) {
        throw new Exception("Failed to update work order details.");
    }
    $stmt_update_wo->close();

    // Block 3: If the completed WO was a PM, automatically generate the next one.
    if (isset($data->status) && $data->status === 'Completed' && isset($data->wo_type) && $data->wo_type === 'PM') {
        $stmt_get_schedule_id = $conn->prepare("SELECT pm_schedule_id FROM workorders WHERE id = ?");
        $stmt_get_schedule_id->bind_param("i", $id);
        $stmt_get_schedule_id->execute();
        $completed_wo = $stmt_get_schedule_id->get_result()->fetch_assoc();
        $stmt_get_schedule_id->close();

        $schedule_id = $completed_wo['pm_schedule_id'] ?? null;

        if ($schedule_id) {
            $stmt_get_schedule = $conn->prepare("SELECT * FROM pm_schedules WHERE id = ? AND is_active = 1");
            $stmt_get_schedule->bind_param("i", $schedule_id);
            $stmt_get_schedule->execute();
            $schedule_result = $stmt_get_schedule->get_result();
            $stmt_get_schedule->close();
            
            if ($schedule_result->num_rows > 0) {
                $schedule = $schedule_result->fetch_assoc();
                
                $checklist_data = json_decode($schedule['checklist'], true) ?: [];
                $parts_data = json_decode($schedule['requiredParts'], true) ?: [];

                $next_pm_date = new DateTime($schedule['last_generated_date'] ?? $schedule['schedule_start_date']);
                switch ($schedule['frequency']) {
                    case 'Weekly': $next_pm_date->modify('+1 week'); break;
                    case 'Monthly': $next_pm_date->modify('+1 month'); break;
                    case 'Quarterly': $next_pm_date->modify('+3 months'); break;
                    case 'Yearly': $next_pm_date->modify('+1 year'); break;
                }
                
                $new_start_date_str = $next_pm_date->format('Y-m-d');
                $new_due_date = clone $next_pm_date;
                $new_due_date->modify('+7 days');
                $new_due_date_str = $new_due_date->format('Y-m-d');
                
                $new_checklist_json = json_encode($checklist_data);
                $new_parts_json = json_encode($parts_data);

                $stmt_insert = $conn->prepare("INSERT INTO workorders (title, description, assetId, assignedTo, task, start_date, dueDate, priority, frequency, status, checklist, requiredParts, wo_type, pm_schedule_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt_insert->bind_param("ssiisssssssssi", 
                    $schedule['title'], $schedule['description'], $schedule['assetId'], $schedule['assignedTo'], $schedule['task'], 
                    $new_start_date_str, $new_due_date_str, 'Medium', $schedule['frequency'], 'Open', 
                    $new_checklist_json, $new_parts_json, 'PM', $schedule['id']
                );
                $stmt_insert->execute();
                $stmt_insert->close();
                
                $stmt_update_schedule = $conn->prepare("UPDATE pm_schedules SET last_generated_date = ? WHERE id = ?");
                $stmt_update_schedule->bind_param("si", $new_start_date_str, $schedule_id);
                $stmt_update_schedule->execute();
                $stmt_update_schedule->close();
            }
        }
    }
    
    // If all steps succeeded, commit the changes to the database.
    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Work Order updated successfully."]);

} catch (Exception $e) {
    // If any step failed, roll back all database changes and report the error.
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update Work Order: " . $e->getMessage()]);
}

$conn->close();
?>