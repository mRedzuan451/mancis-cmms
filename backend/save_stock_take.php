<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('stock_take_create', $conn);
$data = json_decode(file_get_contents("php://input"), true);
$id = $data['id'];
$items = $data['items'];
$is_submitting = $data['is_submitting'];

$conn->begin_transaction();
try {
    $stmt_update_item = $conn->prepare("UPDATE stock_take_items SET counted_qty = ? WHERE stock_take_id = ? AND id = ?");
    foreach($items as $item) {
        $counted_qty = $item['counted_qty'] === '' ? null : intval($item['counted_qty']);
        $stmt_update_item->bind_param("iii", $counted_qty, $id, $item['id']);
        $stmt_update_item->execute();
    }
    $stmt_update_item->close();

    if ($is_submitting) {
        $stmt_submit = $conn->prepare("UPDATE stock_takes SET status = 'Pending Approval' WHERE id = ?");
        $stmt_submit->bind_param("i", $id);
        $stmt_submit->execute();
        $stmt_submit->close();
    }
    
    $conn->commit();
    echo json_encode(["message" => "Stock take progress saved."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to save progress.", "error" => $e->getMessage()]);
}
$conn->close();
?>