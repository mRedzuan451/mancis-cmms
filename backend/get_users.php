<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["message" => "Connection Failed", "error" => $conn->connect_error]);
    exit();
}

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$sql = "";
// Select all fields EXCEPT the password for security
$base_sql = "SELECT id, fullName, employeeId, username, email, contact_number, role, divisionId, departmentId FROM users";

if ($user_role === 'Admin') {
    // Admin gets all users
    $sql = "$base_sql ORDER BY fullName ASC";
    $stmt = $conn->prepare($sql);
} else {
    // Non-Admins (like Managers) only see users within their own department.
    $sql = "$base_sql WHERE departmentId = ? ORDER BY fullName ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_department_id);
}

$stmt->execute();
$result = $stmt->get_result();

$output_array = array();
while($row = $result->fetch_assoc()) {
    $row['id'] = intval($row['id']);
    $row['divisionId'] = intval($row['divisionId']);
    $row['departmentId'] = intval($row['departmentId']);
    $output_array[] = $row;
}

$stmt->close();
$conn->close();
echo json_encode($output_array);
?>