<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["message" => "Database connection failed: " . $conn->connect_error]);
    exit();
}

authorize('asset_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

// --- START: PAGINATION LOGIC ---
$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20; // Default to 20 items per page
$offset = ($page - 1) * $limit;

$total_records = 0;
$assets_array = [];

// 1. Get the total count of records
$count_sql = "";
if ($user_role === 'Admin') {
    $count_sql = "SELECT COUNT(*) as total FROM assets";
    $stmt_count = $conn->prepare($count_sql);
} else {
    $count_sql = "SELECT COUNT(*) as total FROM assets WHERE departmentId = ?";
    $stmt_count = $conn->prepare($count_sql);
    $stmt_count->bind_param("i", $user_department_id);
}
$stmt_count->execute();
$count_result = $stmt_count->get_result();
$total_records = $count_result->fetch_assoc()['total'];
$stmt_count->close();


// 2. Get the paginated data
$data_sql = "";
if ($user_role === 'Admin') {
    $data_sql = "SELECT * FROM assets ORDER BY name ASC LIMIT ? OFFSET ?";
    $stmt_data = $conn->prepare($data_sql);
    $stmt_data->bind_param("ii", $limit, $offset);
} else {
    $data_sql = "SELECT * FROM assets WHERE departmentId = ? ORDER BY name ASC LIMIT ? OFFSET ?";
    $stmt_data = $conn->prepare($data_sql);
    $stmt_data->bind_param("iii", $user_department_id, $limit, $offset);
}
// --- END: PAGINATION LOGIC ---

$stmt_data->execute();
$result = $stmt_data->get_result();

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

// --- START: NEW RESPONSE FORMAT ---
// Return the data along with pagination info
echo json_encode([
    'total' => $total_records,
    'page' => $page,
    'limit' => $limit,
    'data' => $assets_array
]);
// --- END: NEW RESPONSE FORMAT ---
?>