<?php
// backend/get_feedback.php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('feedback_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$sql = "";
$params = [];
$param_types = "";

if ($user_role === 'Admin') {
    // Admin sees all messages from all departments
    $sql = "SELECT f.*, u.fullName as sender_name, d.name as department_name 
            FROM feedback f 
            LEFT JOIN users u ON f.user_id = u.id 
            LEFT JOIN departments d ON f.department_id = d.id
            ORDER BY f.timestamp DESC";
} else {
    // Other users see messages targeted to their role or 'All', within their department
    $sql = "SELECT f.*, u.fullName as sender_name 
            FROM feedback f 
            LEFT JOIN users u ON f.user_id = u.id 
            WHERE f.department_id = ? AND (f.target_role = 'All' OR f.target_role = ?)
            ORDER BY f.timestamp DESC";
    $param_types = "is";
    $params = [$user_department_id, $user_role];
}

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($param_types, ...$params);
}
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