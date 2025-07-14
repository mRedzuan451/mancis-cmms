<?php
require_once 'auth_check.php';
// All logged-in users can access this page, so no specific role check here.
// The SQL query will handle the authorization.

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// --- NEW FILTERING LOGIC ---
$sql = "";
$user_role = $_SESSION['user_role'];
$user_id = $_SESSION['user_id'];
$user_department_id = $_SESSION['user_department_id'];

if ($user_role === 'Admin') {
    // Admins can see all requests.
    $sql = "SELECT * FROM partrequests ORDER BY requestDate DESC";
} else if ($user_role === 'Manager' || $user_role === 'Supervisor') {
    // Managers/Supervisors see requests from users in their own department.
    // We need to join with the users table to get the requester's department.
    $sql = "SELECT pr.* FROM partrequests pr 
            JOIN users u ON pr.requesterId = u.id 
            WHERE u.departmentId = " . $user_department_id . " 
            ORDER BY pr.requestDate DESC";
} else {
    // Regular users can only see their own requests.
    $sql = "SELECT * FROM partrequests WHERE requesterId = " . $user_id . " ORDER BY requestDate DESC";
}
// --- END NEW LOGIC ---

$result = $conn->query($sql);

$output_array = array();
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['quantity'] = intval($row['quantity']);
        $row['partId'] = $row['partId'] ? intval($row['partId']) : null;
        $row['requesterId'] = intval($row['requesterId']);

        $output_array[] = $row;
    }
}
$conn->close();
echo json_encode($output_array);
?>