<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('user_edit', $conn);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$data = json_decode(file_get_contents("php://input"));

$id = isset($data->userId) ? intval($data->userId) : 0;
$role = isset($data->role) ? $data->role : '';

if ($id <= 0 || empty($role)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid user ID or role provided."]);
    exit();
}

if ($id === 1) {
    http_response_code(403);
    echo json_encode(["message" => "The primary admin's role cannot be changed."]);
    exit();
}

$stmt = $conn->prepare("UPDATE users SET role = ? WHERE id = ?");
$stmt->bind_param("si", $role, $id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        http_response_code(200);
        echo json_encode(["message" => "User role updated successfully."]);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "User not found or role is already set to this value."]);
    }
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update user role."]);
}

$stmt->close();
$conn->close();
?>