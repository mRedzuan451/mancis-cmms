<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('stock_take_create', $conn);

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

$sql = "SELECT sti.*, p.name, p.sku 
        FROM stock_take_items sti
        JOIN parts p ON sti.part_id = p.id
        WHERE sti.stock_take_id = ?
        ORDER BY p.name ASC";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();

$output = [];
while($row = $result->fetch_assoc()) {
    $output[] = $row;
}

echo json_encode($output);
$stmt->close();
$conn->close();
?>