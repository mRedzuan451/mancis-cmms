<?php
require_once 'auth_check.php';

require_once 'database.php';

header("Content-Type: application/json; charset=UTF-8");

$conn = getDbConnection();

authorize('asset_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
$offset = ($page - 1) * $limit;

$params = [];
$types = "";

$base_sql = "SELECT * FROM assets";
$where_sql = "";
if ($user_role !== 'Admin') {
    $where_sql = " WHERE departmentId = ?";
    $params[] = $user_department_id;
    $types .= "i";
}

// Count total records
$count_sql = "SELECT COUNT(*) as total FROM assets" . $where_sql;
$stmt_count = $conn->prepare($count_sql);
if (!empty($params)) {
    $stmt_count->bind_param($types, ...$params);
}
$stmt_count->execute();
$total_records = $stmt_count->get_result()->fetch_assoc()['total'];
$stmt_count->close();

// Fetch data
$data_sql = $base_sql . $where_sql . " ORDER BY name ASC";
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

$assets_array = [];
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['cost'] = floatval($row['cost']);
        $relatedParts = json_decode($row['relatedParts']);
        $row['relatedParts'] = is_array($relatedParts) ? $relatedParts : [];
        $assets_array[] = $row;
    }
}
$stmt_data->close();
$conn->close();

echo json_encode([
    'total' => $total_records,
    'page' => $page,
    'limit' => $limit,
    'data' => $assets_array
]);
?>