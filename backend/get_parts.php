<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// The authorize() call is now in the correct place.
authorize('part_view', $conn);

$sql = "SELECT * FROM parts ORDER BY name ASC";
$result = $conn->query($sql);

$output_array = array();
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['quantity'] = intval($row['quantity']);
        $row['minQuantity'] = intval($row['minQuantity']);
        $row['price'] = floatval($row['price']);
        $row['relatedAssets'] = json_decode($row['relatedAssets']);
        if (!is_array($row['relatedAssets'])) {
            $row['relatedAssets'] = [];
        }
        $output_array[] = $row;
    }
}
$conn->close();
echo json_encode($output_array);
?>