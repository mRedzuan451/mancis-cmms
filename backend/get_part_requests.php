<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_request_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
$offset = ($page - 1) * $limit;

$total_records = 0;
$output_array = [];

// --- START: MODIFICATION ---
// The query to get the department name now correctly joins from the users table (u)
// instead of the partrequests table (pr).
$count_base = "SELECT COUNT(DISTINCT pr.id) as total 
               FROM partrequests pr 
               LEFT JOIN users u ON pr.requesterId = u.id";

$data_base = "SELECT pr.*, u.fullName as requesterName, d.name as departmentName
              FROM partrequests pr 
              LEFT JOIN users u ON pr.requesterId = u.id
              LEFT JOIN departments d ON u.departmentId = d.id";
// --- END: MODIFICATION ---

$where_clause = " WHERE u.departmentId = ?";
$order_clause = " ORDER BY pr.requestDate DESC LIMIT ? OFFSET ?";

// 1. Get the total count of records
if ($user_role === 'Admin') {
    $stmt_count = $conn->prepare($count_base);
} else {
    $stmt_count = $conn->prepare($count_base . $where_clause);
    $stmt_count->bind_param("i", $user_department_id);
}
$stmt_count->execute();
$total_records = $stmt_count->get_result()->fetch_assoc()['total'];
$stmt_count->close();

// 2. Get the paginated data
if ($user_role === 'Admin') {
    $stmt_data = $conn->prepare($data_base . $order_clause);
    $stmt_data->bind_param("ii", $limit, $offset);
} else {
    $stmt_data = $conn->prepare($data_base . $where_clause . $order_clause);
    $stmt_data->bind_param("iii", $user_department_id, $limit, $offset);
}

$stmt_data->execute();
$result = $stmt_data->get_result();

if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['quantity'] = intval($row['quantity']);
        $row['partId'] = $row['partId'] ? intval($row['partId']) : null;
        $row['requesterId'] = intval($row['requesterId']);
        $output_array[] = $row;
    }
}

$stmt_data->close();
$conn->close();

echo json_encode([
    'total' => $total_records,
    'page' => $page,
    'limit' => $limit,
    'data' => $output_array
]);
?>