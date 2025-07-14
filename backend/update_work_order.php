<?php

require_once 'auth_check.php';

header("Access-Control-Allow-Origin: *");
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

$checklistJson = json_encode($data->checklist);
$requiredPartsJson = json_encode($data->requiredParts);

$stmt = $conn->prepare("UPDATE workorders SET title=?, description=?, assetId=?, assignedTo=?, task=?, dueDate=?, priority=?, frequency=?, status=?, breakdownTimestamp=?, checklist=?, requiredParts=?, completionNotes=?, completedDate=? WHERE id=?");
$stmt->bind_param("ssiissssssssssi", 
    $data->title, 
    $data->description, 
    $data->assetId, 
    $data->assignedTo, 
    $data->task, 
    $data->dueDate, 
    $data->priority, 
    $data->frequency, 
    $data->status, 
    $data->breakdownTimestamp,
    $checklistJson,
    $requiredPartsJson,
    $data->completionNotes,
    $data->completedDate,
    $id
);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "Work Order updated successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update Work Order."]);
}

$stmt->close();
$conn->close();
?>