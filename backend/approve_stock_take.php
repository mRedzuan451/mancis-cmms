<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('stock_take_approve', $conn);
$data = json_decode(file_get_contents("php://input"), true);
$id = $data['id'];
$approver_id = $_SESSION['user_id'];
$log_user = $_SESSION['user_fullname'];

$conn->begin_transaction();
try {
    $items_result = $conn->query("SELECT part_id, counted_qty FROM stock_take_items WHERE stock_take_id = $id AND counted_qty IS NOT NULL");
    $stmt_update_part = $conn->prepare("UPDATE parts SET quantity = ? WHERE id = ?");
    $adjusted_count = 0;

    while ($item = $items_result->fetch_assoc()) {
        $stmt_update_part->bind_param("ii", $item['counted_qty'], $item['part_id']);
        $stmt_update_part->execute();
        $adjusted_count++;
    }
    $stmt_update_part->close();

    $stmt_finalize = $conn->prepare("UPDATE stock_takes SET status = 'Completed', approver_id = ?, completion_date = NOW() WHERE id = ?");
    $stmt_finalize->bind_param("ii", $approver_id, $id);
    $stmt_finalize->execute();
    $stmt_finalize->close();

    $log_details = "Stock Take #$id approved. Adjusted quantity for $adjusted_count parts.";
    $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Stock Take Approved', ?)");
    $log_stmt->bind_param("ss", $log_user, $log_details);
    $log_stmt->execute();
    $log_stmt->close();
    
    $conn->commit();
    echo json_encode(["message" => "Stock take approved and inventory updated."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to approve stock take.", "error" => $e->getMessage()]);
}
$conn->close();
?>