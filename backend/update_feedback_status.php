<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('feedback_view', $conn); // Any user who can view can update their own status

$data = json_decode(file_get_contents("php://input"));
$id = $data->id ?? 0; // This is the feedback_id
$status = $data->status ?? '';
$user_id = $_SESSION['user_id']; // The user whose status we are changing

if ($id <= 0 || !in_array($status, ['Read', 'Archived'])) {
    http_response_code(400);
    echo json_encode(['message' => 'Invalid ID or status provided.']);
    exit();
}

// Update the status for the specific feedback ID and the current user ID
$stmt = $conn->prepare("UPDATE feedback_read_status SET status = ? WHERE feedback_id = ? AND user_id = ?");
$stmt->bind_param("sii", $status, $id, $user_id);
$stmt->execute();

echo json_encode(['message' => 'Status updated.']);
$stmt->close();
$conn->close();
?>