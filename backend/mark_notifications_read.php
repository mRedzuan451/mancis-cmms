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

// Expects an array of notification IDs
$notificationIds = isset($data->ids) && is_array($data->ids) ? $data->ids : [];

if (empty($notificationIds)) {
    http_response_code(400);
    echo json_encode(["message" => "No notification IDs provided."]);
    exit();
}

// Create placeholders for the IN clause (e.g., ?,?,?)
$placeholders = implode(',', array_fill(0, count($notificationIds), '?'));
// Add the requesterId to the list of parameters for binding
$params = array_merge($notificationIds, [$user_id]);
// Create the type string (e.g., iii)
$types = str_repeat('i', count($notificationIds)) . 'i';

// Update the flag to 1 (viewed) only for the specified IDs belonging to the current user
$sql = "UPDATE partrequests SET requester_viewed_status = 1 WHERE id IN ($placeholders) AND requesterId = ?";
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