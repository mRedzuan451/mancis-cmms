<?php

require_once 'auth_check.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

require_once 'database.php';
$conn = getDbConnection();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->action)) {
    http_response_code(400);
    echo json_encode(["message" => "Log action is required."]);
    exit();
}

$user = isset($data->user) ? $data->user : 'System';
$action = $data->action;
$details = isset($data->details) ? $data->details : '';

$stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $user, $action, $details);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Log created."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create log."]);
}

$stmt->close();
$conn->close();
?>