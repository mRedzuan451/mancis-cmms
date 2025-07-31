<?php
// backend/submit_feedback.php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$user_id = $_SESSION['user_id'];
$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];
$message = $data->message ?? '';
$target_role = $data->target_role ?? 'All';

if (empty(trim($message))) {
    http_response_code(400);
    echo json_encode(['message' => 'Message cannot be empty.']);
    exit();
}

// Subordinates can only send to 'All'
if (!in_array($user_role, ['Admin', 'Manager', 'Supervisor']) && $target_role !== 'All') {
    http_response_code(403);
    echo json_encode(['message' => 'You do not have permission to send targeted messages.']);
    exit();
}

$department_id_to_log = $user_department_id;
// Admins can target a specific department
if ($user_role === 'Admin' && isset($data->department_id)) {
    $department_id_to_log = intval($data->department_id);
}

$stmt = $conn->prepare("INSERT INTO feedback (user_id, department_id, message, target_role) VALUES (?, ?, ?, ?)");
$stmt->bind_param("iiss", $user_id, $department_id_to_log, $message, $target_role);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(['message' => 'Message sent successfully.']);
} else {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to send message.']);
}
$stmt->close();
$conn->close();
?>