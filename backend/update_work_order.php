<?php
// backend/update_work_order.php (Simplified Version - Corrected)

require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor', 'Engineer', 'Technician']);

header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

// --- THIS IS THE FIX ---
// Changed intval($id) to intval($_GET['id'])
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid Work Order ID."]);
    exit();
}

try {
    // We will now directly update the work order.
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
        $data->wo_type,
        $id
    );

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(["message" => "Work Order updated successfully (inventory not deducted)."]);
    } else {
        throw new Exception("Failed to update work order main details.");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update Work Order: " . $e->getMessage()]);
}

$conn->close();
?>