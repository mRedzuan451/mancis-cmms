<?php
// backend/create_pm_schedule.php
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

$checklistJson = json_encode($data->checklist);
$requiredPartsJson = json_encode($data->requiredParts);

$stmt = $conn->prepare("INSERT INTO pm_schedules (title, assetId, task, description, frequency, assignedTo, checklist, requiredParts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("sisssiss",
    $data->title,
    $data->assetId,
    $data->task,
    $data->description,
    $data->frequency,
    $data->assignedTo,
    $checklistJson,
    $requiredPartsJson
);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "PM Schedule created successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create PM Schedule."]);
}

$stmt->close();
$conn->close();
?>