<?php
// backend/mark_notifications_read.php

require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$user_id = $_SESSION['user_id'];
$data = json_decode(file_get_contents("php://input"));
$notificationIds = $data->ids ?? [];

if (empty($notificationIds)) {
    http_response_code(400);
    echo json_encode(["message" => "No notification IDs provided."]);
    exit();
}

// Create placeholders for the IN clause (e.g., ?,?,?)
$placeholders = implode(',', array_fill(0, count($notificationIds), '?'));
$types = str_repeat('i', count($notificationIds)) . 'i';

// Update the flag to 1 (viewed) only for the specified IDs belonging to the current user
$sql = "UPDATE notifications SET is_read = 1 WHERE id IN ($placeholders) AND user_id = ?";
$params = array_merge($notificationIds, [$user_id]);
$types .= 'i';
$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "Notifications marked as read."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to mark notifications as read."]);
}

$stmt->close();
$conn->close();
?>