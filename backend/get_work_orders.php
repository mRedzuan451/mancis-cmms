<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// No authorization check here as it's handled by filtering below

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

// --- START: PAGINATION LOGIC ---
$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
$offset = ($page - 1) * $limit;

$total_records = 0;
$output_array = [];

// Base queries
$count_base = "SELECT COUNT(DISTINCT wo.id) as total FROM workorders wo LEFT JOIN assets a ON wo.assetId = a.id";
$data_base = "SELECT wo.* FROM workorders wo LEFT JOIN assets a ON wo.assetId = a.id";
$where_clause = " WHERE a.departmentId = ?";
$order_clause = " ORDER BY wo.dueDate DESC LIMIT ? OFFSET ?";

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
// --- END: PAGINATION LOGIC ---

$stmt_data->execute();
$result = $stmt_data->get_result();

if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['assetId'] = intval($row['assetId']);
        $row['assignedTo'] = $row['assignedTo'] ? intval($row['assignedTo']) : null;
        $row['pm_schedule_id'] = $row['pm_schedule_id'] ? intval($row['pm_schedule_id']) : null;
        
        $row['checklist'] = json_decode($row['checklist'], true) ?: [];
        $row['requiredParts'] = json_decode($row['requiredParts'], true) ?: [];
        
        $output_array[] = $row;
    }
}
$stmt_data->close();
$conn->close();

// --- START: NEW RESPONSE FORMAT ---
echo json_encode([
    'total' => $total_records,
    'page' => $page,
    'limit' => $limit,
    'data' => $output_array
]);
// --- END: NEW RESPONSE FORMAT ---
?>