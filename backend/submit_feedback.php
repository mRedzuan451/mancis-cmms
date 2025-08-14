<?php
// backend/submit_feedback.php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

$data = json_decode(file_get_contents("php://input"));
$user_id = $_SESSION['user_id'];
$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];
$message = $data->message ?? '';
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

// Start a transaction to ensure all database operations succeed or fail together
$conn->begin_transaction();

try {
    // 1. Insert the main message into the feedback table
    $sql = "INSERT INTO feedback (user_id, department_id, message, target_role, parent_id) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new Exception("Failed to prepare the database query. Ensure the 'feedback' table structure is correct.");
    }
    $stmt->bind_param("iissi", $user_id, $department_id_to_log, $message, $target_role, $parent_id);
    $stmt->execute();
    $feedback_id = $stmt->insert_id; // Get the ID of the new message
    $stmt->close();

    // 2. Find all users who should receive this message
    if ($parent_id) {
        // If it's a reply, the only recipient is the author of the parent message
        $stmt_parent = $conn->prepare("SELECT user_id FROM feedback WHERE id = ?");
        $stmt_parent->bind_param("i", $parent_id);
        $stmt_parent->execute();
        $parent_author_id = $stmt_parent->get_result()->fetch_assoc()['user_id'];
        $stmt_parent->close();
        
        $recipients_result = [['id' => $parent_author_id]];
    } else {
        // If it's a new message, find recipients based on target role/department
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
        if (!empty($params)) {
            $stmt_users->bind_param($types, ...$params);
        }
        $stmt_users->execute();
        $recipients_result = $stmt_users->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_users->close();
    }


    // 3. Create a 'New' status entry for each recipient in the tracking table
    $stmt_status = $conn->prepare("INSERT INTO feedback_read_status (feedback_id, user_id, status) VALUES (?, ?, 'New')");
    foreach ($recipients_result as $user) {
        // A user does not need a 'New' status for their own message
        if ($user['id'] != $user_id) {
            $stmt_status->bind_param("ii", $feedback_id, $user['id']);
            $stmt_status->execute();
        }
    }
    $stmt_status->close();
    
    // 4. Create a 'Read' status for the sender so they can see their own message
    $stmt_sender_status = $conn->prepare("INSERT IGNORE INTO feedback_read_status (feedback_id, user_id, status) VALUES (?, ?, 'Read')");
    $stmt_sender_status->bind_param("ii", $feedback_id, $user_id);
    $stmt_sender_status->execute();
    $stmt_sender_status->close();


    // 5. Create notifications for recipients
    $sender_name = $_SESSION['user_fullname'];
    $notification_message = ($parent_id ? "New reply from " : "New message from ") . $sender_name;
    $stmt_notify = $conn->prepare("INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, 'team_message', ?, ?)");
    
    foreach ($recipients_result as $user) {
        // Don't send a notification to the person who sent the message
        if ($user['id'] != $user_id) {
            $stmt_notify->bind_param("isi", $user['id'], $notification_message, $feedback_id);
            $stmt_notify->execute();
        }
    }
    $stmt_notify->close();

    // If everything was successful, commit the changes to the database
    $conn->commit();
    http_response_code(201);
    echo json_encode(['message' => 'Message sent successfully.']);

} catch (Exception $e) {
    // If any step failed, roll back all database changes
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['message' => 'Failed to send message.', 'error' => $e->getMessage()]);
}

$conn->close();
?>