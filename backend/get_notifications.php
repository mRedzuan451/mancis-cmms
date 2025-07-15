<?php
// backend/get_notifications.php

require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$user_id = $_SESSION['user_id'];

// Select all requests for the current user where the status has not been viewed yet
$sql = "SELECT * FROM partrequests WHERE requesterId = ? AND requester_viewed_status = 0";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$notifications = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $notifications[] = $row;
    }
}

$stmt->close();
$conn->close();
echo json_encode($notifications);
?>