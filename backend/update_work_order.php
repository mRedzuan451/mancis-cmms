<?php
// backend/update_work_order.php (Enhanced Debugging Version)

// --- Force error reporting to be visible ---
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor', 'Engineer', 'Technician']);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// Log that the script has started
error_log("--- Starting update_work_order.php ---");

$data = json_decode(file_get_contents("php://input"));
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

// Log the received data
error_log("Received data for WO ID: $id -> " . print_r($data, true));

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid Work Order ID."]);
    exit();
}

$conn->begin_transaction();
error_log("Transaction started for WO ID: $id");

try {
    if (isset($data->status) && $data->status === 'Completed') {
        error_log("Status is 'Completed'. Starting parts consumption for WO ID: $id");
        
        $stmt_get = $conn->prepare("SELECT requiredParts FROM workorders WHERE id = ?");
        $stmt_get->bind_param("i", $id);
        $stmt_get->execute();
        $wo_result = $stmt_get->get_result()->fetch_assoc();
        $stmt_get->close();
        
        $requiredParts = isset($wo_result['requiredParts']) ? json_decode($wo_result['requiredParts'], true) : [];
        error_log("Required parts for WO ID: $id -> " . print_r($requiredParts, true));

        if (!empty($requiredParts)) {
            $log_details = "Consumed parts for WO #$id: ";
            $details_array = [];
            
            // --- THIS IS THE FIX ---
            // This loop now checks if the part data is valid before using it.
            foreach ($requiredParts as $part) {
                // Check for malformed part data and skip it if found.
                if (!isset($part['partId']) || !isset($part['quantity'])) {
                    error_log("Skipping malformed required part entry for WO ID $id: " . print_r($part, true));
                    continue; 
                }

                $partId = intval($part['partId']);
                $qty_to_deduct = intval($part['quantity']);

                // The rest of the logic inside the loop remains the same.
                $stmt_update_part = $conn->prepare("UPDATE parts SET quantity = quantity - ? WHERE id = ? AND quantity >= ?");
                $stmt_update_part->bind_param("iii", $qty_to_deduct, $partId, $qty_to_deduct);
                $stmt_update_part->execute();
                
                if ($stmt_update_part->affected_rows === 0) {
                    throw new Exception("Not enough stock for Part ID: $partId, or part not found.");
                }
                $stmt_update_part->close();
                $details_array[] = "$qty_to_deduct x PartID $partId";
            }
            
            // Only create a log if parts were actually processed.
            if (!empty($details_array)) {
                $log_user = $_SESSION['user_fullname'];
                $log_details .= implode(', ', $details_array) . ".";
                $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Parts Consumed', ?)");
                $log_stmt->bind_param("ss", $log_user, $log_details);
                $log_stmt->execute();
                $log_stmt->close();
            }
        }
    }

    error_log("Preparing to update main WO details for WO ID: $id");
    $checklistJson = json_encode($data->checklist);
    $requiredPartsJson = json_encode($data->requiredParts);
    $data->wo_type = $data->wo_type ?? 'CM';

    $stmt = $conn->prepare(
        "UPDATE workorders SET title=?, description=?, assetId=?, assignedTo=?, task=?, dueDate=?, priority=?, frequency=?, status=?, 
        breakdownTimestamp=?, checklist=?, requiredParts=?, completionNotes=?, completedDate=?, wo_type=? WHERE id=?"
    );
    
    $stmt->bind_param("ssiisssssssssssi", 
        $data->title, $data->description, $data->assetId, $data->assignedTo, 
        $data->task, $data->dueDate, $data->priority, $data->frequency, 
        $data->status, $data->breakdownTimestamp, $checklistJson, 
        $requiredPartsJson, $data->completionNotes, $data->completedDate, 
        $data->wo_type, $id
    );

    if ($stmt->execute()) {
        error_log("Main WO UPDATE successful for WO ID: $id. Committing transaction.");
        $conn->commit();
        http_response_code(200);
        echo json_encode(["message" => "Work Order updated successfully."]);
    } else {
        throw new Exception("Failed to update work order main details.");
    }

} catch (Exception $e) {
    error_log("!!! EXCEPTION CAUGHT for WO ID: $id. Rolling back. Error: " . $e->getMessage());
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update Work Order: " . $e->getMessage()]);
}

$conn->close();
error_log("--- Finished update_work_order.php ---");
?>