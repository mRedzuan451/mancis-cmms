<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; 
$username = "root"; 
$password = ""; 
$dbname = "mancis_db";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["message" => "Connection failed: " . $conn->connect_error]);
    exit();
}

$sql = "SELECT * FROM receivedparts ORDER BY receivedDate DESC";
$result = $conn->query($sql);

$output_array = array();
if ($result && $result->num_rows > 0) {
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