<?php
// backend/create_work_order.php (Corrected Version)

require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor', 'Engineer', 'Technician']);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

if (empty($data->title) || empty($data->assetId) || empty($data->dueDate)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Title, Asset, and Due Date are required."]);
    exit();
}

$checklistJson = json_encode($data->checklist);
$requiredPartsJson = json_encode($data->requiredParts);

// This query now includes the 'start_date' column.
$stmt = $conn->prepare(
    "INSERT INTO workorders (title, description, assetId, assignedTo, task, start_date, dueDate, priority, frequency, status, breakdownTimestamp, checklist, requiredParts, wo_type) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

// The bind_param string is updated to include the new date field (s).
$stmt->bind_param("ssiissssssssss", 
    $data->title, $data->description, $data->assetId, $data->assignedTo, 
    $data->task, $data->start_date, $data->dueDate, $data->priority, 
    $data->frequency, $data->status, $data->breakdownTimestamp,
    $checklistJson, $requiredPartsJson, $data->wo_type
);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Work Order created successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create Work Order.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>