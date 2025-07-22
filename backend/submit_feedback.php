<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$user_id = $_SESSION['user_id'];
$message = $data->message ?? '';

if (empty(trim($message))) {
    http_response_code(400);
    echo json_encode(['message' => 'Feedback message cannot be empty.']);
    exit();
}

$stmt = $conn->prepare("INSERT INTO feedback (user_id, message) VALUES (?, ?)");
$stmt->bind_param("is", $user_id, $message);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(['message' => 'Feedback submitted successfully.']);
} else {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to submit feedback.']);
}
$stmt->close();
$conn->close();
?>