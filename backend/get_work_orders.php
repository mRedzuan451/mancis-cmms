<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// --- THIS IS THE FIX ---
// The 'pm_schedule_id' column has been added to the SELECT statement.
$sql = "SELECT id, title, description, assetId, assignedTo, task, start_date, dueDate, priority, frequency, status, breakdownTimestamp, checklist, requiredParts, completionNotes, completedDate, wo_type, pm_schedule_id FROM workorders ORDER BY dueDate DESC";
$result = $conn->query($sql);

$output_array = array();
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['assetId'] = intval($row['assetId']);
        $row['assignedTo'] = intval($row['assignedTo']);
        
        // --- ADD THIS LINE ---
        // Ensure the pm_schedule_id is correctly formatted as a number (or null).
        $row['pm_schedule_id'] = $row['pm_schedule_id'] ? intval($row['pm_schedule_id']) : null;

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