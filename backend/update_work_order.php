<?php
require_once 'auth_check.php';
require_once 'calendar_integration.php';
authorize('wo_edit');

header("Content-Type: application/json; charset=UTF-8");
date_default_timezone_set('Asia/Kuala_Lumpur');

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

$conn->begin_transaction();

try {
    // --- START: FIX ---
    // The logic has been restructured to be more reliable.

    // Step 1: Update the main work order details first.
    $checklistJson = json_encode($data->checklist);
    $requiredPartsJson = json_encode($data->requiredParts);
    $wo_type = $data->wo_type ?? 'CM';
    $completedDate = ($data->status === 'Completed' && empty($data->completedDate)) ? date('Y-m-d') : $data->completedDate;

    $stmt_update_wo = $conn->prepare("UPDATE workorders SET title=?, description=?, assetId=?, assignedTo=?, task=?, start_date=?, dueDate=?, priority=?, frequency=?, status=?, breakdownTimestamp=?, checklist=?, requiredParts=?, completionNotes=?, completedDate=?, wo_type=? WHERE id=?");
    if ($stmt_update_wo === false) { throw new Exception("Failed to prepare the main update statement."); }

    $stmt_update_wo->bind_param("ssiissssssssssssi", 
        $data->title, $data->description, $data->assetId, $data->assignedTo, 
        $data->task, $data->start_date, $data->dueDate, $data->priority, 
        $data->frequency, $data->status, $data->breakdownTimestamp, 
        $checklistJson, $requiredPartsJson, $data->completionNotes, 
        $completedDate, $wo_type, $id
    );

    if (!$stmt_update_wo->execute()) {
        throw new Exception("Failed to execute work order update: " . $stmt_update_wo->error);
    }
    $stmt_update_wo->close();

    // Step 2: If the status was just changed to 'Completed', run the special logic.
    if (isset($data->status) && $data->status === 'Completed') {
        
        // Block for Part Consumption
        $requiredParts = $data->requiredParts ?? [];
        if (!empty($requiredParts) && is_array($requiredParts)) {
            $details_array = [];
            foreach ($requiredParts as $part) {
                if (!isset($part['partId']) || !isset($part['quantity'])) continue;
                $partId = intval($part['partId']);
                $qty_to_deduct = intval($part['quantity']);
                
                $stmt_update_part = $conn->prepare("UPDATE parts SET quantity = quantity - ? WHERE id = ? AND quantity >= ?");
                if ($stmt_update_part === false) { throw new Exception("Failed to prepare part update statement."); }
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
                $log_details_parts = "Consumed parts for WO #$id: " . implode(', ', $details_array) . ".";
                $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Parts Consumed', ?)");
                $log_stmt->bind_param("ss", $log_user, $log_details_parts);
                $log_stmt->execute();
                $log_stmt->close();
            }
        }

        // Block for PM Re-generation (This logic can be added here if needed in the future)
    }

    // --- END: FIX ---

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Work Order updated successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update Work Order: " . $e->getMessage()]);
}

$conn->close();
?>