<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_borrow_approve', $conn);

$data = json_decode(file_get_contents("php://input"));

$id = $data->id ?? 0;
$newStatus = $data->status ?? '';
$approverId = $_SESSION['user_id'];
$userDeptId = $_SESSION['user_department_id'];

if ($id <= 0 || !in_array($newStatus, ['Approved', 'Rejected'])) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid data."]);
    exit();
}

$conn->begin_transaction();
try {
    // Get request details, ensure it's pending and belongs to the approver's department
    $stmt_get = $conn->prepare("SELECT * FROM part_borrows WHERE id = ? AND lendingDeptId = ? AND status = 'Pending'");
    $stmt_get->bind_param("ii", $id, $userDeptId);
    $stmt_get->execute();
    $request = $stmt_get->get_result()->fetch_assoc();
    $stmt_get->close();

    if (!$request) {
        throw new Exception("Request not found, already processed, or you don't have permission to approve it.");
    }

    // If approved, deduct stock from the lender's inventory
    if ($newStatus === 'Approved') {
        $partId = $request['partId'];
        $quantity = $request['quantity'];

        $stmt_part = $conn->prepare("UPDATE parts SET quantity = quantity - ? WHERE id = ? AND quantity >= ?");
        $stmt_part->bind_param("iii", $quantity, $partId, $quantity);
        $stmt_part->execute();

        if ($stmt_part->affected_rows === 0) {
            throw new Exception("Failed to approve: Not enough stock available for the requested part.");
        }
        $stmt_part->close();
        
        $log_details = "Approved borrow request #{$id}. Issued {$quantity} unit(s) of part ID {$partId}.";
        $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Part Borrow Approved', ?)");
        $log_stmt->bind_param("ss", $_SESSION['user_fullname'], $log_details);
        $log_stmt->execute();
        $log_stmt->close();
    }
    
    // Update the borrow request status
    $stmt_update = $conn->prepare("UPDATE part_borrows SET status = ?, approverId = ?, approvalDate = NOW() WHERE id = ?");
    $stmt_update->bind_param("sii", $newStatus, $approverId, $id);
    $stmt_update->execute();
    $stmt_update->close();

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Request has been {$newStatus}."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "An error occurred: " . $e->getMessage()]);
}

$conn->close();
?>