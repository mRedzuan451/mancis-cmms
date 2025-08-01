<?php
require_once 'auth_check.php'; // Ensures only logged-in users can trigger this.

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// This query finds all work orders where the due date is in the past,
// but the status is still something like 'Open' or 'In Progress',
// and updates their status to 'Delay'.
$sql = "UPDATE workorders 
        SET status = 'Delay' 
        WHERE dueDate < CURDATE() 
        AND status NOT IN ('Completed', 'Delay')";

$conn->query($sql);
$affected_rows = $conn->affected_rows;

$conn->close();

echo json_encode([
    "message" => "Overdue status check complete.",
    "updated_count" => $affected_rows
]);
?>