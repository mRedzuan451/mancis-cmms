<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// Any user who can request a borrow can also return it.
authorize('part_borrow_request', $conn);

$data = json_decode(file_get_contents("php://input"));
$id = $data->id ?? 0;
$userDeptId = $_SESSION['user_department_id'];

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid borrow request ID."]);
    exit();
}

$conn->begin_transaction();
try {
    // 1. Get the borrow request details
    $stmt_get = $conn->prepare("SELECT * FROM part_borrows WHERE id = ?");
    $stmt_get->bind_param("i", $id);
    $stmt_get->execute();
    $request = $stmt_get->get_result()->fetch_assoc();
    $stmt_get->close();

    // 2. Validate the request
    if (!$request) {
        throw new Exception("Borrow request not found.");
    }
    if ($request['status'] !== 'Approved') {
        throw new Exception("This part cannot be returned as the request is not in 'Approved' status.");
    }
    if ($request['borrowingDeptId'] != $userDeptId) {
        throw new Exception("You can only return parts borrowed by your department.");
    }

    // 3. Add the quantity back to the original lender's inventory
    $partId = $request['partId'];
    $quantity = $request['quantity'];
    $stmt_part = $conn->prepare("UPDATE parts SET quantity = quantity + ? WHERE id = ?");
    $stmt_part->bind_param("ii", $quantity, $partId);
    $stmt_part->execute();
    $stmt_part->close();

    // 4. Update the borrow request status to 'Returned'
    $stmt_update = $conn->prepare("UPDATE part_borrows SET status = 'Returned', returnDate = NOW() WHERE id = ?");
    $stmt_update->bind_param("i", $id);
    $stmt_update->execute();
    $stmt_update->close();

    // 5. Log the action
    $log_details = "Returned {$quantity} unit(s) of part ID {$partId} from borrow request #{$id}.";
    $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Part Borrow Returned', ?)");
    $log_stmt->bind_param("ss", $_SESSION['user_fullname'], $log_details);
    $log_stmt->execute();
    $log_stmt->close();
    
    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Part returned successfully to the lending department."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "An error occurred: " . $e->getMessage()]);
}

$conn->close();
?>