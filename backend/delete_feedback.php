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

// First, check if the SQL command executed without errors
if ($stmt->execute()) {
    // If successful, then check if a row was actually deleted
    if ($stmt->affected_rows > 0) {
        http_response_code(200); // OK
        echo json_encode(["message" => "Feedback deleted successfully."]);
    } else {
        // The command ran fine, but no message with that ID was found
        http_response_code(404); // Not Found
        echo json_encode(["message" => "Feedback message not found."]);
    }
} else {
    // The command itself failed to run, indicating a server-side problem
    http_response_code(500); // Internal Server Error
    echo json_encode(["message" => "Failed to delete feedback due to a server error.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>