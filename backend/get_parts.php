<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
$offset = ($page - 1) * $limit;

$total_records = 0;
$output_array = [];

// --- START: MODIFICATION ---
// New, more robust queries that correctly filter parts for non-admins.
$count_base = "SELECT COUNT(DISTINCT p.id) as total 
               FROM parts p 
               LEFT JOIN departments d ON p.departmentId = d.id";

$data_base = "SELECT p.*, d.name as departmentName 
              FROM parts p 
              LEFT JOIN departments d ON p.departmentId = d.id";

// For non-admins, we only show parts that are in their department's storage.
$where_clause = " WHERE p.departmentId = ?";
$order_clause = " ORDER BY p.name ASC";

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
    $data_sql = $data_base . $order_clause;
    if ($limit > 0) {
        $data_sql .= " LIMIT ? OFFSET ?";
        $stmt_data = $conn->prepare($data_sql);
        $stmt_data->bind_param("ii", $limit, $offset);
    } else {
        $stmt_data = $conn->prepare($data_sql);
    }
} else {
    $data_sql = $data_base . $where_clause . $order_clause;
    if ($limit > 0) {
        $data_sql .= " LIMIT ? OFFSET ?";
        $stmt_data = $conn->prepare($data_sql);
        $stmt_data->bind_param("iii", $user_department_id, $limit, $offset);
    } else {
        $stmt_data = $conn->prepare($data_sql);
        $stmt_data->bind_param("i", $user_department_id);
    }
}
// --- END: MODIFICATION ---


$stmt_data->execute();
$result = $stmt_data->get_result();

if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['quantity'] = intval($row['quantity']);
        $row['minQuantity'] = intval($row['minQuantity']);
        $row['price'] = floatval($row['price']);
        $row['relatedAssets'] = json_decode($row['relatedAssets']);
        if (!is_array($row['relatedAssets'])) {
            $row['relatedAssets'] = [];
        }
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