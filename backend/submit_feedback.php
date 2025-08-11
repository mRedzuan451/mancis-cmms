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
// --- START: MODIFICATION ---
$parent_id = isset($data->parentId) && !empty($data->parentId) ? intval($data->parentId) : null;

// Determine the target role based on the 'action' parameter or default
// If it's a reply, target role is inherited, otherwise check the form data.
if ($parent_id) {
    $target_role = 'All'; // Replies don't have new targets
} elseif (isset($data->action) && $data->action === 'send_to_admin') {
    $target_role = 'Admin';
} else {
    $target_role = $data->target_role ?? 'All';
}
// --- END: MODIFICATION ---

if (empty(trim($message))) {
    http_response_code(400);
    echo json_encode(['message' => 'Message cannot be empty.']);
    exit();
}

// Security check: Only certain roles can send targeted messages
if (!$parent_id && !in_array($user_role, ['Admin', 'Manager', 'Supervisor']) && $target_role !== 'All' && $target_role !== 'Admin') {
    http_response_code(403);
    echo json_encode(['message' => 'You do not have permission to send targeted messages.']);
    exit();
}

$department_id_to_log = $user_department_id;
// If an admin is sending a message on behalf of another department
if ($user_role === 'Admin' && isset($data->department_id) && !empty($data->department_id)) {
    $department_id_to_log = intval($data->department_id);
}

$conn->begin_transaction();

try {
    // --- START: MODIFICATION (Query and Bind Params) ---
    $sql = "INSERT INTO feedback (user_id, department_id, message, target_role, parent_id) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new Exception("Failed to prepare the database query. Ensure the 'feedback' table structure is correct.");
    }
    // The bind param string is now "iissi" to account for the integer parent_id
    $stmt->bind_param("iissi", $user_id, $department_id_to_log, $message, $target_role, $parent_id);
    // --- END: MODIFICATION ---
    $stmt->execute();
    $feedback_id = $stmt->insert_id; 
    $stmt->close();

    // The rest of the notification logic remains largely the same
    if ($parent_id) {
        // If it's a reply, notify only the parent author (if they aren't the one replying)
        $stmt_parent = $conn->prepare("SELECT user_id FROM feedback WHERE id = ?");
        $stmt_parent->bind_param("i", $parent_id);
        $stmt_parent->execute();
        $parent_author_id = $stmt_parent->get_result()->fetch_assoc()['user_id'];
        $stmt_parent->close();
        
        $recipients = [['id' => $parent_author_id]];
    } else {
        // If it's a new message, find recipients as before
        $get_users_sql = "SELECT id FROM users";
        $params = [];
        $types = "";
        if ($target_role === 'Admin') {
            $get_users_sql .= " WHERE role = 'Admin'";
        } else {
            $get_users_sql .= " WHERE departmentId = ?";
            $params[] = $department_id_to_log;
            $types .= "i";
            if ($target_role !== 'All') {
                $get_users_sql .= " AND role = ?";
                $params[] = $target_role;
                $types .= "s";
            }
        }
        $stmt_users = $conn->prepare($get_users_sql);
        if (!empty($params)) { $stmt_users->bind_param($types, ...$params); }
        $stmt_users->execute();
        $recipients = $stmt_users->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_users->close();
    }
    
    // Create status and notification entries for recipients
    $stmt_status = $conn->prepare("INSERT INTO feedback_read_status (feedback_id, user_id, status) VALUES (?, ?, 'New')");
    $notification_message = ($parent_id ? "New reply from " : "New message from ") . $_SESSION['user_fullname'];
    $stmt_notify = $conn->prepare("INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, 'team_message', ?, ?)");

    foreach ($recipients as $user) {
        if ($user['id'] != $user_id) {
            $stmt_status->bind_param("ii", $feedback_id, $user['id']);
            $stmt_status->execute();
            $stmt_notify->bind_param("isi", $user['id'], $notification_message, $feedback_id);
            $stmt_notify->execute();
        }
    }
    $stmt_status->close();
    $stmt_notify->close();
    
    $conn->commit();
    http_response_code(201);
    echo json_encode(['message' => 'Message sent successfully.']);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['message' => 'Failed to send message.', 'error' => $e->getMessage()]);
}

$conn->close();
?>