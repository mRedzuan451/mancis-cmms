<?php

require_once 'auth_check.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('log_view', $conn);

// Limit to the most recent 200 logs for performance
$sql = "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200";
$result = $conn->query($sql);

$output_array = array();
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $output_array[] = $row;
    }
}
$conn->close();
echo json_encode($output_array);
?>