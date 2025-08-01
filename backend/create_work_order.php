<?php
require_once 'auth_check.php';
require_once 'calendar_integration.php'; 

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('wo_create', $conn);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$data = json_decode(file_get_contents("php://input"));

if (empty($data->title) || empty($data->assetId) || empty($data->dueDate) || empty($data->start_date)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Title, Asset, Start Date, and Due Date are required."]);
    exit();
}

$conn->begin_transaction();

try {
    $checklistJson = json_encode($data->checklist);
    $requiredPartsJson = json_encode($data->requiredParts);
    $wo_type = $data->wo_type ?? 'CM';

    $stmt = $conn->prepare(
        "INSERT INTO workorders (title, description, assetId, assignedTo, task, start_date, dueDate, priority, frequency, status, breakdownTimestamp, checklist, requiredParts, wo_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("ssiissssssssss", 
        $data->title, $data->description, $data->assetId, $data->assignedTo, 
        $data->task, $data->start_date, $data->dueDate, $data->priority, 
        $data->frequency, $data->status, $data->breakdownTimestamp,
        $checklistJson, $requiredPartsJson, $wo_type
    );

    $stmt->execute();
    $new_wo_id = $stmt->insert_id;
    $stmt->close();
    
    logCalendarEvent($data->title, $data->start_date); // Use the new function name
    
    $conn->commit();
    http_response_code(201);
    echo json_encode(["message" => "Work Order created successfully.", "id" => $new_wo_id]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to create Work Order.", "error" => $e->getMessage()]);
}

$conn->close();
?>