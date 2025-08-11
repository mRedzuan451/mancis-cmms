<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_borrow_request', $conn);

$part_id = isset($_GET['partId']) ? intval($_GET['partId']) : 0;
$user_department_id = $_SESSION['user_department_id'];

if ($part_id <= 0) {
    http_response_code(400);
    echo json_encode([]);
    exit();
}

// First, get the SKU of the requested part
$stmt_sku = $conn->prepare("SELECT sku FROM parts WHERE id = ?");
$stmt_sku->bind_param("i", $part_id);
$stmt_sku->execute();
$sku_result = $stmt_sku->get_result()->fetch_assoc();
$sku = $sku_result ? $sku_result['sku'] : null;
$stmt_sku->close();

if (!$sku) {
    http_response_code(404);
    echo json_encode([]);
    exit();
}

// Now find other parts with the same SKU in different departments
$stmt = $conn->prepare(
    "SELECT p.id, p.quantity, d.name as departmentName, d.id as departmentId
     FROM parts p
     JOIN departments d ON p.departmentId = d.id
     WHERE p.sku = ? AND p.departmentId != ? AND p.quantity > 0"
);
$stmt->bind_param("si", $sku, $user_department_id);
$stmt->execute();
$result = $stmt->get_result();

$borrowable_parts = [];
while ($row = $result->fetch_assoc()) {
    $borrowable_parts[] = $row;
}

echo json_encode($borrowable_parts);
$stmt->close();
$conn->close();
?>