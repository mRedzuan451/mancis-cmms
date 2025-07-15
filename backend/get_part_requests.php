<?php
require_once 'auth_check.php'; // We still need this to establish a session.

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) { 
    http_response_code(500);
    echo json_encode(["message" => "Connection failed: " . $conn->connect_error]);
    exit();
}

// TEMPORARY DEBUGGING CODE: Select everything, ignoring user roles.
$sql = "SELECT * FROM partrequests ORDER BY requestDate DESC";
$result = $conn->query($sql);

if ($result === false) {
    http_response_code(500);
    echo json_encode(["message" => "SQL query failed.", "error" => $conn->error]);
    exit();
}

$output_array = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['quantity'] = intval($row['quantity']);
        $row['partId'] = $row['partId'] ? intval($row['partId']) : null;
        $row['requesterId'] = intval($row['requesterId']);
        $output_array[] = $row;
    }
}

$conn->close();
echo json_encode($output_array);
?>