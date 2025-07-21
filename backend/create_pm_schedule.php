<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('pm_schedule_create', $conn);

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));

// --- START: FIX ---
$checklistJson = json_encode($data->checklist ?? []);
$requiredPartsJson = json_encode($data->requiredParts ?? []);

$stmt = $conn->prepare("INSERT INTO pm_schedules (title, schedule_start_date, assetId, task, description, frequency_interval, frequency_unit, due_date_buffer, assignedTo, is_active, checklist, requiredParts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("ssissisiiiss",
    $data->title,
    $data->schedule_start_date,
    $data->assetId,
    $data->task,
    $data->description,
    $data->frequency_interval,
    $data->frequency_unit,
    $data->due_date_buffer,
    $data->assignedTo,
    $data->is_active,
    $checklistJson,
    $requiredPartsJson
);
// --- END: FIX ---

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