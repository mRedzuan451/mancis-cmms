<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_request_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$sql = "";
if ($user_role === 'Admin') {
    $sql = "SELECT * FROM partrequests ORDER BY requestDate DESC";
    $stmt = $conn->prepare($sql);
} else {
    // All other roles see requests where the requester is in their department.
    $sql = "SELECT pr.* FROM partrequests pr 
            JOIN users u ON pr.requesterId = u.id 
            WHERE u.departmentId = ? 
            ORDER BY pr.requestDate DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_department_id);
}

$stmt->execute();
$result = $stmt->get_result();

$output_array = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['quantity'] = intval($row['quantity']);
        $row['partId'] = $row['partId'] ? intval($row['partId']) : null;
        $row['requesterId'] = intval($row['requesterId']);
        $output_array[] = $row;
    }
}

$stmt->close();
$conn->close();
echo json_encode($output_array);
?>