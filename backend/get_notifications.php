<?php
// backend/get_notifications.php

require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
$conn = getDbConnection();

$user_id = $_SESSION['user_id'];

$sql = "SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY timestamp DESC";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$notifications = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        // --- START: MODIFICATION ---
        // Fetch details for both new requests and updates
        if ($row['type'] === 'part_request_update' || $row['type'] === 'part_request_new') {
        // --- END: MODIFICATION ---
            $stmt_pr = $conn->prepare("SELECT * FROM partrequests WHERE id = ?");
            $stmt_pr->bind_param("i", $row['related_id']);
            $stmt_pr->execute();
            $pr_result = $stmt_pr->get_result()->fetch_assoc();
            $stmt_pr->close();
            $row['details'] = $pr_result;
        }
        $notifications[] = $row;
    }
}

$stmt->close();
$conn->close();
echo json_encode($notifications);
?>