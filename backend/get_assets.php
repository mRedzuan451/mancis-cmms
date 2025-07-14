<?php
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor', 'Engineer', 'Technician']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$sql = "SELECT * FROM assets ORDER BY name ASC";
$result = $conn->query($sql);

$assets_array = array();
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['cost'] = floatval($row['cost']);

        $row['relatedParts'] = json_decode($row['relatedParts']);
        if (!is_array($row['relatedParts'])) {
            $row['relatedParts'] = [];
        }
        
        $assets_array[] = $row;
    }
}
$conn->close();
echo json_encode($assets_array);
?>