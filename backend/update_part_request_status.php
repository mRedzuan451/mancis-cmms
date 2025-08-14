<?php
require_once 'auth_check.php';

// --- START: MODIFICATION ---
// I found and fixed the same logical error in this related file.
// 1. Establish the database connection FIRST.
require_once 'database.php';
$conn = getDbConnection();
    http_response_code(503);
    echo json_encode(["message" => "Database connection failed."]);
    exit();
}

// 2. NOW call authorize() with the correct permission key and the $conn variable.
authorize('part_request_approve', $conn);
// --- END: MODIFICATION ---

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

// ... (rest of the file is correct and remains unchanged)
$data = json_decode(file_get_contents("php://input"));

$id = isset($data->id) ? intval($data->id) : 0;
$rejectionReason = isset($data->rejectionReason) ? $data->rejectionReason : null;

if ($id <= 0 || empty($data->status) || empty($data->approverId)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid data provided."]);
    exit();
}

$conn->begin_transaction();

try {
    $request_sql = "SELECT * FROM partrequests WHERE id = ?";
    $stmt_get = $conn->prepare($request_sql);
    $stmt_get->bind_param("i", $id);
    $stmt_get->execute();
    $request_result = $stmt_get->get_result();
    if ($request_result->num_rows === 0) {
        throw new Exception("Request not found.");
    }
    $request = $request_result->fetch_assoc();
    $stmt_get->close();

    if ($data->status === 'Approved' && $request['status'] === 'Requested from Storage') {
        $part_id = $request['partId'];
        $quantity_requested = $request['quantity'];

        $part_update_sql = "UPDATE parts SET quantity = quantity - ? WHERE id = ? AND quantity >= ?";
        $stmt_part = $conn->prepare($part_update_sql);
        $stmt_part->bind_param("iii", $quantity_requested, $part_id, $quantity_requested);
        $stmt_part->execute();

        if ($stmt_part->affected_rows === 0) {
            throw new Exception("Not enough stock to fulfill storage request or part not found.");
        }
        $stmt_part->close();
        
        $log_user = $_SESSION['user_fullname'];
        $log_details = "Issued from storage for request #" . $request['id'] . ": " . $quantity_requested . " x PartID " . $part_id;
        $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Parts Issued from Storage', ?)");
        $log_stmt->bind_param("ss", $log_user, $log_details);
        $log_stmt->execute();
        $log_stmt->close();

        $data->status = 'Completed'; 
    }

    $stmt = $conn->prepare("UPDATE partrequests SET status = ?, approverId = ?, approvalDate = NOW(), rejectionReason = ?, requester_viewed_status = 0 WHERE id = ?");
    $stmt->bind_param("sisi", $data->status, $data->approverId, $rejectionReason, $id);
    $stmt->execute();
    $stmt->close();

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Request status updated successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => $e->getMessage()]);
}

$conn->close();
?>