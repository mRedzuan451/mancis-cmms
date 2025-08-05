<?php
// backend/get_feedback.php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('feedback_view', $conn);

$user_id = $_SESSION['user_id']; // The ID of the logged-in user

// This query now joins the new status table to get the status for the current user
$sql = "SELECT 
            f.*, 
            u.fullName as sender_name, 
            d.name as department_name,
            frs.status
        FROM feedback f
        JOIN feedback_read_status frs ON f.id = frs.feedback_id
        LEFT JOIN users u ON f.user_id = u.id 
        LEFT JOIN departments d ON f.department_id = d.id
        WHERE frs.user_id = ?
        ORDER BY f.timestamp DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$output = [];
while($row = $result->fetch_assoc()) {
    $output[] = $row;
}

echo json_encode($output);
$stmt->close();
$conn->close();
?>