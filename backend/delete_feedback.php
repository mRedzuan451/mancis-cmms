<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('feedback_delete', $conn);

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid feedback ID."]);
    exit();
}

$stmt = $conn->prepare("DELETE FROM feedback WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute() && $stmt->affected_rows > 0) {
    http_response_code(200);
    echo json_encode(["message" => "Feedback deleted successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to delete feedback or not found."]);
}

$stmt->close();
$conn->close();
?>