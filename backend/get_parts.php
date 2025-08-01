<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

// --- START: PAGINATION LOGIC ---
$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
$offset = ($page - 1) * $limit;

$total_records = 0;
$output_array = [];

// 1. Get the total count of records
$count_sql = "";
if ($user_role === 'Admin') {
    $count_sql = "SELECT COUNT(*) as total FROM parts";
    $stmt_count = $conn->prepare($count_sql);
} else {
    $count_sql = "SELECT COUNT(*) as total FROM parts WHERE departmentId = ?";
    $stmt_count = $conn->prepare($count_sql);
    $stmt_count->bind_param("i", $user_department_id);
}
$stmt_count->execute();
$total_records = $stmt_count->get_result()->fetch_assoc()['total'];
$stmt_count->close();

// 2. Get the paginated data
$data_sql = "";
if ($user_role === 'Admin') {
    $data_sql = "SELECT p.*, d.name as departmentName 
                 FROM parts p
                 LEFT JOIN departments d ON p.departmentId = d.id
                 ORDER BY p.name ASC LIMIT ? OFFSET ?";
    $stmt_data = $conn->prepare($data_sql);
    $stmt_data->bind_param("ii", $limit, $offset);
} else {
    $data_sql = "SELECT * FROM parts WHERE departmentId = ? ORDER BY name ASC LIMIT ? OFFSET ?";
    $stmt_data = $conn->prepare($data_sql);
    $stmt_data->bind_param("iii", $user_department_id, $limit, $offset);
}
// --- END: PAGINATION LOGIC ---

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

// --- START: NEW RESPONSE FORMAT ---
echo json_encode([
    'total' => $total_records,
    'page' => $page,
    'limit' => $limit,
    'data' => $output_array
]);
// --- END: NEW RESPONSE FORMAT ---
?>