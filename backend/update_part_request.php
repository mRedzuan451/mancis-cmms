<?php
// backend/update_part_request.php

require_once 'auth_check.php';
// Any logged-in user can attempt this, but we'll check ownership below.

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;
$user_id = $_SESSION['user_id'];

if ($id <= 0 || empty($data->quantity) || empty($data->purpose)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data provided."]);
    exit();
}

// Check ownership and status before updating
$check_stmt = $conn->prepare("SELECT requesterId, status FROM partrequests WHERE id = ?");
$check_stmt->bind_param("i", $id);
$check_stmt->execute();
$result = $check_stmt->get_result();
$request = $result->fetch_assoc();
$check_stmt->close();

if (!$request) {
    http_response_code(404);
    echo json_encode(["message" => "Request not found."]);
    exit();
}

if ($request['requesterId'] != $user_id) {
    http_response_code(403);
    echo json_encode(["message" => "You can only edit your own requests."]);
    exit();
}

if ($request['status'] !== 'Requested') {
    http_response_code(403);
    echo json_encode(["message" => "This request cannot be edited as it has already been processed."]);
    exit();
}

// All checks passed, proceed with update
$stmt = $conn->prepare("UPDATE partrequests SET partId = ?, quantity = ?, purpose = ? WHERE id = ?");
$stmt->bind_param("iisi", $data->partId, $data->quantity, $data->purpose, $id);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "Request updated successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update request."]);
}

$stmt->close();
$conn->close();
?>