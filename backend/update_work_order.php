<?php
require_once 'auth_check.php';

// Authorize who can update work orders.
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

$conn->begin_transaction();

try {
    // If the status is being set to 'Completed', handle part consumption first.
    if ($data->status === 'Completed') {
        // Fetch the required parts for this work order.
        $stmt_get = $conn->prepare("SELECT requiredParts FROM workorders WHERE id = ?");
        $stmt_get->bind_param("i", $id);
        $stmt_get->execute();
        $wo_result = $stmt_get->get_result()->fetch_assoc();
        $stmt_get->close();
        
        $requiredParts = json_decode($wo_result['requiredParts'], true);

        if (!empty($requiredParts)) {
            $log_details = "Consumed parts for WO #$id: ";
            $details_array = [];
            
            foreach ($requiredParts as $part) {
                $partId = intval($part['partId']);
                $qty_to_deduct = intval($part['quantity']);

                // Deduct quantity from the parts table.
                $stmt_update_part = $conn->prepare("UPDATE parts SET quantity = quantity - ? WHERE id = ? AND quantity >= ?");
                $stmt_update_part->bind_param("iii", $qty_to_deduct, $partId, $qty_to_deduct);
                $stmt_update_part->execute();
                
                if ($stmt_update_part->affected_rows === 0) {
                    throw new Exception("Not enough stock for Part ID: $partId, or part not found.");
                }
                $stmt_update_part->close();
                $details_array[] = "$qty_to_deduct x PartID $partId";
            }
            
            // Log the consumption activity for auditing.
            $log_user = $_SESSION['user_fullname'];
            $log_details .= implode(', ', $details_array) . ".";
            $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Parts Consumed', ?)");
            $log_stmt->bind_param("ss", $log_user, $log_details);
            $log_stmt->execute();
            $log_stmt->close();
        }
    }

    // Now, update the work order itself.
    $checklistJson = json_encode($data->checklist);
    $requiredPartsJson = json_encode($data->requiredParts);

    $stmt = $conn->prepare("UPDATE workorders SET title=?, description=?, assetId=?, assignedTo=?, task=?, dueDate=?, priority=?, frequency=?, status=?, breakdownTimestamp=?, checklist=?, requiredParts=?, completionNotes=?, completedDate=? WHERE id=?");
    $stmt->bind_param("ssiissssssssssi", 
        $data->title, $data->description, $data->assetId, $data->assignedTo, 
        $data->task, $data->dueDate, $data->priority, $data->frequency, 
        $data->status, $data->breakdownTimestamp, $checklistJson, 
        $requiredPartsJson, $data->completionNotes, $data->completedDate, $id
    );

    if ($stmt->execute()) {
        $conn->commit(); // Commit transaction after all operations succeed.
        http_response_code(200);
        echo json_encode(["message" => "Work Order updated successfully."]);
    } else {
        throw new Exception("Failed to update work order main details.");
    }

} catch (Exception $e) {
    $conn->rollback(); // Rollback transaction on any error.
    http_response_code(500);
    echo json_encode(["message" => "Failed to update Work Order: " . $e->getMessage()]);
}

$conn->close();
?>