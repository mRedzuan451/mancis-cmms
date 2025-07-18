<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_request_view', $conn);

$user_role = $_SESSION['user_role'];
$user_id = $_SESSION['user_id'];
$user_department_id = $_SESSION['user_department_id'];

$sql = "";
$params = [];
$types = "";

// Determine the correct SQL query based on the user's role
if ($user_role === 'Admin') {
    $sql = "SELECT * FROM partrequests ORDER BY requestDate DESC";
} else if ($user_role === 'Manager' || $user_role === 'Supervisor') {
    $sql = "SELECT pr.* FROM partrequests pr JOIN users u ON pr.requesterId = u.id WHERE u.departmentId = ? ORDER BY pr.requestDate DESC";
    $types = "i";
    $params[] = $user_department_id;
} else {
    $sql = "SELECT * FROM partrequests WHERE requesterId = ? ORDER BY requestDate DESC";
    $types = "i";
    $params[] = $user_id;
}

// Prepare and execute the statement
$stmt = $conn->prepare($sql);

if ($stmt === false) {
    http_response_code(500);
    echo json_encode(["message" => "SQL prepare statement failed.", "error" => $conn->error]);
    exit();
}

if ($types) {
    $stmt->bind_param($types, ...$params);
}

$stmt->execute();
$result = $stmt->get_result();

if ($result === false) {
    http_response_code(500);
    echo json_encode(["message" => "Database query failed.", "error" => $stmt->error]);
    exit();
}

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