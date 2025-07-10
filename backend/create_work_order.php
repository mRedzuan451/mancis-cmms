<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

if (empty($data->title) || empty($data->assetId) || empty($data->dueDate)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data for Work Order."]);
    exit();
}

// Encode checklist and required parts arrays into JSON strings for database storage
$checklistJson = json_encode($data->checklist);
$requiredPartsJson = json_encode($data->requiredParts);

$stmt = $conn->prepare("INSERT INTO workorders (title, description, assetId, assignedTo, task, dueDate, priority, frequency, status, breakdownTimestamp, checklist, requiredParts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("ssiissssssss", 
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
    $requiredPartsJson
);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Work Order created successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create Work Order."]);
}

$stmt->close();
$conn->close();
?>