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

$total_records = 0;
$output_array = [];

// --- START: MODIFICATION ---
// These new queries are more robust. Instead of relying on a stored departmentId on the parts table,
// they dynamically join through the location tables (boxes, shelves, cabinets) to find the correct department.
// This is the same reliable logic used by the Work Orders list.

$count_base = "SELECT COUNT(DISTINCT p.id) as total 
               FROM parts p 
               LEFT JOIN boxes b ON p.locationId = CONCAT('box-', b.id)
               LEFT JOIN shelves sh ON b.shelfId = sh.id
               LEFT JOIN cabinets cab ON sh.cabinetId = cab.id";

$data_base = "SELECT p.*, d.name as departmentName 
              FROM parts p 
              LEFT JOIN departments d ON p.departmentId = d.id"; // This join is now just for getting the name for Admins

// The WHERE clause now correctly filters by the department linked to the part's storage location.
$where_clause = " WHERE cab.departmentId = ?";
$order_clause = " ORDER BY p.name ASC";

// 1. Get the total count of records
if ($user_role === 'Admin') {
    $stmt_count = $conn->prepare($count_base);
} else {
    // We add the joins here for non-admins to correctly filter the count.
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
    // For non-admins, we add the joins to the main data query as well.
    $data_sql = "SELECT p.*, d.name as departmentName 
                 FROM parts p 
                 LEFT JOIN departments d ON p.departmentId = d.id
                 LEFT JOIN boxes b ON p.locationId = CONCAT('box-', b.id)
                 LEFT JOIN shelves sh ON b.shelfId = sh.id
                 LEFT JOIN cabinets cab ON sh.cabinetId = cab.id
                 " . $where_clause . $order_clause;
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