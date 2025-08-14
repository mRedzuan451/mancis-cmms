<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('wo_edit', $conn);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid Work Order ID."]);
    exit();
}

date_default_timezone_set('Asia/Kuala_Lumpur');
$now = date('Y-m-d H:i:s');

// Updated to include 'Delay' in the list of valid statuses
$stmt = $conn->prepare("UPDATE workorders SET status = 'In Progress', actualStartDate = ? WHERE id = ? AND status IN ('Open', 'On Hold', 'Delay')");
$stmt->bind_param("si", $now, $id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        http_response_code(200);
        echo json_encode(["message" => "Work order started successfully."]);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Work order not found, already in progress, or completed."]);
    }
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to start work order."]);
}

$stmt->close();
$conn->close();
?>