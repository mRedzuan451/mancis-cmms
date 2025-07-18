<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// This query now selects all the necessary columns to prevent 'N/A' issues.
$sql = "SELECT id, title, schedule_start_date, assetId, task, description, frequency_interval, frequency_unit, due_date_buffer, assignedTo, is_active, last_generated_date FROM pm_schedules ORDER BY id DESC";
$result = $conn->query($sql);

authorize('pm_schedule_view', $conn);

$schedules = [];
if ($result) {
    while($row = $result->fetch_assoc()) {
        // Ensure correct data types for JSON
        $row['id'] = intval($row['id']);
        $row['assetId'] = intval($row['assetId']);
        $row['assignedTo'] = $row['assignedTo'] ? intval($row['assignedTo']) : null;
        $row['is_active'] = intval($row['is_active']);
        $row['frequency_interval'] = intval($row['frequency_interval']);
        $row['due_date_buffer'] = $row['due_date_buffer'] ? intval($row['due_date_buffer']) : null;
        
        $schedules[] = $row;
    }
}

$conn->close();
echo json_encode($schedules);
?>