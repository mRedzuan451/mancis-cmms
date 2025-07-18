<?php
// backend/get_received_parts.php

require_once 'auth_check.php';

// --- ADD THIS LINE TO DEFINE PERMISSIONS ---
// Grant access to anyone who can manage parts or requests.

// Turn on error reporting for better debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; 
$username = "root"; 
$password = ""; 
$dbname = "mancis_db";

$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["message" => "Connection failed: " . $conn->connect_error]);
    exit();
}

$sql = "SELECT * FROM receivedparts ORDER BY receivedDate DESC";
$result = $conn->query($sql);

// Check for SQL query errors
if (!$result) {
    http_response_code(500);
    echo json_encode([
        "message" => "SQL Query Failed",
        "error" => $conn->error,
        "query" => $sql
    ]);
    $conn->close();
    exit();
}

$output_array = array();
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        // Ensure numeric types are correct for JSON
        $row['id'] = intval($row['id']);
        $row['requestId'] = intval($row['requestId']);
        $row['partId'] = $row['partId'] ? intval($row['partId']) : null;
        $row['quantity'] = intval($row['quantity']);
        $row['receiverId'] = intval($row['receiverId']);
        $output_array[] = $row;
    }
}

$conn->close();
echo json_encode($output_array);
?>