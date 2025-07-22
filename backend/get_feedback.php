<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('feedback_view', $conn);

$sql = "SELECT f.*, u.fullName as sender_name 
        FROM feedback f 
        LEFT JOIN users u ON f.user_id = u.id 
        ORDER BY f.timestamp DESC";
$result = $conn->query($sql);

$output = [];
while($row = $result->fetch_assoc()) {
    $output[] = $row;
}

echo json_encode($output);
$conn->close();
?>