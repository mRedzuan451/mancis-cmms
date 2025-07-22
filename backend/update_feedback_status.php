<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('feedback_view', $conn);

$data = json_decode(file_get_contents("php://input"));
$id = $data->id ?? 0;
$status = $data->status ?? '';

if ($id <= 0 || !in_array($status, ['Read', 'Archived'])) {
    http_response_code(400);
    echo json_encode(['message' => 'Invalid ID or status provided.']);
    exit();
}

$stmt = $conn->prepare("UPDATE feedback SET status = ? WHERE id = ?");
$stmt->bind_param("si", $status, $id);
$stmt->execute();

echo json_encode(['message' => 'Status updated.']);
$stmt->close();
$conn->close();
?>