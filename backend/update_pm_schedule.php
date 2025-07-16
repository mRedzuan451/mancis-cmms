<?php
// backend/update_pm_schedule.php
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;

$checklistJson = json_encode($data->checklist);
$requiredPartsJson = json_encode($data->requiredParts);

$stmt = $conn->prepare("UPDATE pm_schedules SET title=?, schedule_start_date=?, assetId=?, task=?, description=?, frequency=?, assignedTo=?, checklist=?, requiredParts=?, is_active=? WHERE id=?");
$stmt->bind_param("ssisssissi",
    $data->title, $data->schedule_start_date, $data->assetId, $data->task,
    $data->description, $data->frequency, $data->assignedTo,
    $checklistJson, $requiredPartsJson, $data->is_active, $id
);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "PM Schedule updated successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update PM Schedule."]);
}
$stmt->close();
$conn->close();
?>