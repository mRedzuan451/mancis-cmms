<?php

require_once 'auth_check.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$sql = "SELECT * FROM parts ORDER BY name ASC";
$result = $conn->query($sql);

$output_array = array();
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        // Convert numeric types from strings to numbers for correct JSON formatting
        $row['id'] = intval($row['id']);
        $row['quantity'] = intval($row['quantity']);
        $row['minQuantity'] = intval($row['minQuantity']);
        $row['price'] = floatval($row['price']);
        $output_array[] = $row;
    }
}
$conn->close();
echo json_encode($output_array);
?>