<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
$conn = getDbConnection();

authorize('user_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
$offset = ($page - 1) * $limit;

$params = [];
$types = "";

$base_sql = "SELECT id, fullName, employeeId, username, email, contact_number, role, divisionId, departmentId FROM users";
$where_sql = "";
if ($user_role !== 'Admin') {
    $where_sql = " WHERE departmentId = ?";
    $params[] = $user_department_id;
    $types .= "i";
}

// Count total records for pagination info
$count_sql = "SELECT COUNT(*) as total FROM users" . $where_sql;
$stmt_count = $conn->prepare($count_sql);
if (!empty($params)) {
    $stmt_count->bind_param($types, ...$params);
}
$stmt_count->execute();
$total_records = $stmt_count->get_result()->fetch_assoc()['total'];
$stmt_count->close();

// Fetch data
$data_sql = $base_sql . $where_sql . " ORDER BY fullName ASC";
if ($limit > 0) {
    $data_sql .= " LIMIT ? OFFSET ?";
    $params[] = $limit;
    $types .= "i";
    $params[] = $offset;
    $types .= "i";
}

$stmt_data = $conn->prepare($data_sql);
if (!empty($params)) {
    $stmt_data->bind_param($types, ...$params);
}
$stmt_data->execute();
$result = $stmt_data->get_result();

$output_array = array();
while($row = $result->fetch_assoc()) {
    $row['id'] = intval($row['id']);
    $row['divisionId'] = intval($row['divisionId']);
    $row['departmentId'] = intval($row['departmentId']);
    $output_array[] = $row;
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