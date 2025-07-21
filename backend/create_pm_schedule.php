<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('pm_schedule_create', $conn);

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));

$stmt = $conn->prepare("INSERT INTO pm_schedules (title, schedule_start_date, assetId, task, description, frequency_interval, frequency_unit, due_date_buffer, assignedTo, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("ssissisiii",
    $data->title,
    $data->schedule_start_date,
    $data->assetId,
    $data->task,
    $data->description,
    $data->frequency_interval,
    $data->frequency_unit,
    $data->due_date_buffer,
    $data->assignedTo,
    $data->is_active
);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "PM Schedule created successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create PM Schedule.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>