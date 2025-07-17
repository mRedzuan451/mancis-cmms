<?php
// backend/get_work_orders.php

require_once 'auth_check.php';
// No specific role authorization needed here, as filtering happens on the front-end based on what the user can see.

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// --- THIS IS THE CORRECTED LINE ---
$sql = "SELECT id, title, description, assetId, assignedTo, task, start_date, dueDate, priority, frequency, status, breakdownTimestamp, checklist, requiredParts, completionNotes, completedDate, wo_type FROM workorders ORDER BY dueDate DESC";
$result = $conn->query($sql);

$output_array = array();
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        // --- ADDED THIS LINE TO ENSURE START DATE IS INCLUDED ---
        $row['start_date'] = $row['start_date']; 

        // Existing type conversions
        $row['id'] = intval($row['id']);
        $row['assetId'] = intval($row['assetId']);
        $row['assignedTo'] = intval($row['assignedTo']);
        
        $row['checklist'] = json_decode($row['checklist'], true);
        $row['requiredParts'] = json_decode($row['requiredParts'], true);

        if (!is_array($row['checklist'])) $row['checklist'] = [];
        if (!is_array($row['requiredParts'])) $row['requiredParts'] = [];
        
        $output_array[] = $row;
    }
}
$conn->close();
echo json_encode($output_array);
?>