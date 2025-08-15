<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
$conn = getDbConnection();

authorize('part_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
$offset = ($page - 1) * $limit;
$searchTerm = isset($_GET['search']) ? $_GET['search'] : '';

$params = [];
$types = "";
$where_clauses = [];

$count_base = "SELECT COUNT(DISTINCT p.id) as total FROM parts p LEFT JOIN departments d ON p.departmentId = d.id";
$data_base = "SELECT p.*, d.name as departmentName FROM parts p LEFT JOIN departments d ON p.departmentId = d.id";

if ($user_role !== 'Admin') {
    $where_clauses[] = "p.departmentId = ?";
    $params[] = $user_department_id;
    $types .= "i";
}

if (!empty($searchTerm)) {
    $where_clauses[] = "(p.name LIKE ? OR p.sku LIKE ? OR p.maker LIKE ? OR p.category LIKE ?)";
    $likeSearchTerm = "%" . $searchTerm . "%";
    array_push($params, $likeSearchTerm, $likeSearchTerm, $likeSearchTerm, $likeSearchTerm);
    $types .= "ssss";
}

$where_sql = "";
if (!empty($where_clauses)) {
    $where_sql = " WHERE " . implode(" AND ", $where_clauses);
}

// Get total count
$count_sql = $count_base . $where_sql;
$stmt_count = $conn->prepare($count_sql);
if (!empty($params)) {
    $stmt_count->bind_param($types, ...$params);
}
$stmt_count->execute();
$total_records = $stmt_count->get_result()->fetch_assoc()['total'];
$stmt_count->close();

// Get paginated data
if ($limit > 0) {
    $data_sql = $data_base . $where_sql . " ORDER BY p.name ASC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    $types .= "ii";
} else {
    $data_sql = $data_base . $where_sql . " ORDER BY p.name ASC";
}

$stmt_data = $conn->prepare($data_sql);
if (!empty($params)) {
    $stmt_data->bind_param($types, ...$params);
}
$stmt_data->execute();
$result = $stmt_data->get_result();

$output_array = [];
while($row = $result->fetch_assoc()) {
    $row['id'] = intval($row['id']);
    $row['quantity'] = intval($row['quantity']);
    $row['minQuantity'] = intval($row['minQuantity']);
    $row['price'] = floatval($row['price']);
    $row['relatedAssets'] = json_decode($row['relatedAssets']) ?: [];
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