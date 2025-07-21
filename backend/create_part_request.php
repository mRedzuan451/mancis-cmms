<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_request_create', $conn);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$data = json_decode(file_get_contents("php://input"));

if (empty($data->quantity) || empty($data->requesterId) || empty($data->status)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data for Part Request."]);
    exit();
}

$stmt = $conn->prepare("INSERT INTO partrequests (partId, quantity, purpose, requesterId, requestDate, status, notes, newPartName, newPartNumber, newPartMaker) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("iissssssss",
    $data->partId,
    $data->quantity,
    $data->purpose,
    $data->requesterId,
    $data->requestDate,
    $data->status,
    $data->notes,
    $data->newPartName,
    $data->newPartNumber,
    $data->newPartMaker
);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Part Request submitted successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to submit Part Request.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>