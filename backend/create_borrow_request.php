<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('part_borrow_request', $conn);

$data = json_decode(file_get_contents("php://input"));

$partId = $data->partId ?? 0;
$quantity = $data->quantity ?? 0;
$lendingDeptId = $data->lendingDeptId ?? 0;
$notes = $data->notes ?? '';
$workOrderId = $data->workOrderId ?? null;

$borrowingDeptId = $_SESSION['user_department_id'];
$requesterId = $_SESSION['user_id'];

if ($partId <= 0 || $quantity <= 0 || $lendingDeptId <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data provided."]);
    exit();
}

$stmt = $conn->prepare(
    "INSERT INTO part_borrows (partId, quantity, workOrderId, borrowingDeptId, lendingDeptId, requesterId, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?)"
);
$stmt->bind_param("iiiiiss", $partId, $quantity, $workOrderId, $borrowingDeptId, $lendingDeptId, $requesterId, $notes);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Borrow request submitted successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to submit request.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>