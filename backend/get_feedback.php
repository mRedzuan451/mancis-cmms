<?php
// backend/get_feedback.php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('feedback_view', $conn);

$user_id = $_SESSION['user_id'];

// The query remains the same, it fetches all messages and replies the user has access to.
$sql = "SELECT 
            f.*, 
            u.fullName as sender_name, 
            d.name as department_name,
            frs.status
        FROM feedback f
        JOIN feedback_read_status frs ON f.id = frs.feedback_id
        LEFT JOIN users u ON f.user_id = u.id 
        LEFT JOIN departments d ON f.department_id = d.id
        WHERE frs.user_id = ?
        ORDER BY f.timestamp ASC"; // Order by ASC to process parents before children

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

// --- START: MODIFICATION - Threading Logic ---
$messages_by_id = [];
$root_messages = [];

while($row = $result->fetch_assoc()) {
    $row['replies'] = []; // Add a replies array to every message
    $messages_by_id[$row['id']] = $row;
}

foreach ($messages_by_id as $id => &$message) {
    if ($message['parent_id'] !== null && isset($messages_by_id[$message['parent_id']])) {
        // This is a reply, so add it to its parent's 'replies' array
        $messages_by_id[$message['parent_id']]['replies'][] = &$message;
    } else {
        // This is a top-level message
        $root_messages[] = &$message;
    }
}
unset($message); // Unset the reference to avoid bugs

// Sort root messages by timestamp descending to show newest threads first
usort($root_messages, function($a, $b) {
    return strtotime($b['timestamp']) - strtotime($a['timestamp']);
});
// --- END: MODIFICATION ---

echo json_encode($root_messages);
$stmt->close();
$conn->close();
?>