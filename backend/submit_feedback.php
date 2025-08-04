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
if (isset($data->action) && $data->action === 'send_to_admin') {
    $target_role = 'Admin';
} else {
    $target_role = $data->target_role ?? 'All';
}

if (empty(trim($message))) {
    http_response_code(400);
    echo json_encode(['message' => 'Message cannot be empty.']);
    exit();
}

if (!in_array($user_role, ['Admin', 'Manager', 'Supervisor']) && $target_role !== 'All') {
    http_response_code(403);
    echo json_encode(['message' => 'You do not have permission to send targeted messages.']);
    exit();
}

$department_id_to_log = $user_department_id;
if ($user_role === 'Admin' && isset($data->department_id) && !empty($data->department_id)) {
    $department_id_to_log = intval($data->department_id);
}

$sql = "INSERT INTO feedback (user_id, department_id, message, target_role) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sql);

// --- START: FIX ---
// This check prevents a 500 error if the SQL is invalid (e.g., columns are missing).
if ($stmt === false) {
    http_response_code(500);
    echo json_encode([
        "message" => "Failed to prepare the database query.",
        "error" => "Please ensure the 'feedback' table has 'department_id' and 'target_role' columns.",
        "sql_error" => $conn->error
    ]);
    exit();
}
// --- END: FIX ---

$stmt->bind_param("iiss", $user_id, $department_id_to_log, $message, $target_role);

if ($stmt->execute()) {
    $feedback_id = $stmt->insert_id; // Get the ID of the new message

    // --- START: Notification Generation ---
    $get_users_sql = "SELECT id FROM users WHERE departmentId = ?";
    if ($target_role !== 'All') {
        $get_users_sql .= " AND role = ?";
        $stmt_users = $conn->prepare($get_users_sql);
        $stmt_users->bind_param("is", $department_id_to_log, $target_role);
    } else {
        $stmt_users = $conn->prepare($get_users_sql);
        $stmt_users->bind_param("i", $department_id_to_log);
    }
    
    $stmt_users->execute();
    $recipients = $stmt_users->get_result();

    $sender_name = $_SESSION['user_fullname'];
    $notification_message = "New message from " . $sender_name;

    $stmt_notify = $conn->prepare("INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, 'team_message', ?, ?)");
    
    while ($user = $recipients->fetch_assoc()) {
        // Don't send a notification to the person who sent the message
        if ($user['id'] != $user_id) {
            $stmt_notify->bind_param("isi", $user['id'], $notification_message, $feedback_id);
            $stmt_notify->execute();
        }
    }
    $stmt_users->close();
    $stmt_notify->close();
    // --- END: Notification Generation ---

    http_response_code(201);
    echo json_encode(['message' => 'Message sent successfully.']);
} else {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to send message.', 'error' => $stmt->error]);
}

$stmt->close();
$conn->close();
?>