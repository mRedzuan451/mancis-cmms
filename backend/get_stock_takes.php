<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('stock_take_create', $conn);

$sql = "SELECT st.*, u.fullName as creator_name 
        FROM stock_takes st 
        JOIN users u ON st.creator_id = u.id 
        ORDER BY st.creation_date DESC";
$result = $conn->query($sql);

$output = [];
while($row = $result->fetch_assoc()) {
    $output[] = $row;
}

echo json_encode($output);
$conn->close();
?>