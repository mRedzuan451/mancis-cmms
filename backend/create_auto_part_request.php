<?php
require_once 'auth_check.php';
// Any logged-in user can trigger this check, so no specific role is needed.

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

if (empty($data->partId) || empty($data->quantity)) {
    http_response_code(400);
    echo json_encode(["message" => "Part ID and quantity are required."]);
    exit();
}

$partId = intval($data->partId);
$quantity = intval($data->quantity);
$requesterId = $_SESSION['user_id']; // Log the request under the user who logged in.
$purpose = "Automatic restock due to low inventory";
$status = "Requested";
$requestDate = date("Y-m-d");

$stmt = $conn->prepare("INSERT INTO partrequests (partId, quantity, purpose, requesterId, requestDate, status) VALUES (?, ?, ?, ?, ?, ?)");
$stmt->bind_param("iisiss", $partId, $quantity, $purpose, $requesterId, $requestDate, $status);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Automatic part request created successfully for part ID: " . $partId]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create automatic part request."]);
}

$stmt->close();
$conn->close();
?>