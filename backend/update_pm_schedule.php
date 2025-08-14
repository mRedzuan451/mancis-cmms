<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('pm_schedule_create', $conn);

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid PM Schedule ID."]);
    exit();
}

// --- START: FIX ---
$checklistJson = json_encode($data->checklist ?? []);
$requiredPartsJson = json_encode($data->requiredParts ?? []);

$stmt = $conn->prepare("UPDATE pm_schedules SET title = ?, schedule_start_date = ?, assetId = ?, task = ?, description = ?, frequency_interval = ?, frequency_unit = ?, due_date_buffer = ?, assignedTo = ?, is_active = ?, checklist = ?, requiredParts = ? WHERE id = ?");
$stmt->bind_param("ssissisiiissi",
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
    $requiredPartsJson,
    $id
);
// --- END: FIX ---


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