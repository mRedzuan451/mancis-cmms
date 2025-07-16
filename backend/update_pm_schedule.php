<?php
// backend/update_pm_schedule.php (Final, Robust Version)
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor']);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

// --- ROBUST VALIDATION ---
// Check if all required fields exist on the data object.
if (
    !isset($data->id) ||
    !isset($data->title) ||
    !isset($data->schedule_start_date) ||
    !isset($data->assetId) ||
    !isset($data->task) ||
    !isset($data->frequency) ||
    !isset($data->assignedTo) ||
    !isset($data->is_active)
) {
    http_response_code(400); // Bad Request
    echo json_encode(["message" => "Incomplete data provided. All fields are required."]);
    exit();
}

$id = intval($data->id);
$checklistJson = isset($data->checklist) ? json_encode($data->checklist) : '[]';
$requiredPartsJson = isset($data->requiredParts) ? json_encode($data->requiredParts) : '[]';
$is_active = intval($data->is_active);

$stmt = $conn->prepare(
    "UPDATE pm_schedules SET 
        title=?, 
        schedule_start_date=?, 
        assetId=?, 
        task=?, 
        description=?, 
        frequency=?, 
        assignedTo=?, 
        checklist=?, 
        requiredParts=?, 
        is_active=? 
    WHERE id=?"
);

// Note: The bind_param types must exactly match the columns in the query.
$stmt->bind_param("ssisssissii",
    $data->title,
    $data->schedule_start_date,
    $data->assetId,
    $data->task,
    $data->description,
    $data->frequency,
    $data->assignedTo,
    $checklistJson,
    $requiredPartsJson,
    $is_active,
    $id
);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "PM Schedule updated successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update PM Schedule.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>