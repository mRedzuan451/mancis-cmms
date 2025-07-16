<?php
// backend/get_pm_schedules.php
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor', 'Engineer', 'Technician']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$result = $conn->query("SELECT * FROM pm_schedules ORDER BY title ASC");
$schedules = [];
while($row = $result->fetch_assoc()) {
    $row['id'] = intval($row['id']);
    $row['assetId'] = intval($row['assetId']);
    $row['assignedTo'] = $row['assignedTo'] ? intval($row['assignedTo']) : null;
    $row['checklist'] = json_decode($row['checklist']);
    $row['requiredParts'] = json_decode($row['requiredParts']);
    $schedules[] = $row;
}

$conn->close();
echo json_encode($schedules);
?>