<?php

require_once 'auth_check.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

function fetch_table($conn, $tableName) {
    $sql = "SELECT * FROM " . $tableName;
    $result = $conn->query($sql);
    $data = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            // Ensure IDs are integers
            foreach ($row as $key => &$value) {
                if (strpos($key, 'Id') !== false || $key === 'id') {
                    $value = intval($value);
                }
            }
            $data[] = $row;
        }
    }
    return $data;
}

$locations = [
    "divisions" => fetch_table($conn, "divisions"),
    "departments" => fetch_table($conn, "departments"),
    "subLines" => fetch_table($conn, "subLines"),
    "productionLines" => fetch_table($conn, "productionLines"),
    "cabinets" => fetch_table($conn, "cabinets"),
    "shelves" => fetch_table($conn, "shelves"),
    "boxes" => fetch_table($conn, "boxes"),
];

$conn->close();
echo json_encode($locations);
?>