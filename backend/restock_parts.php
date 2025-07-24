<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_restock', $conn);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$data = json_decode(file_get_contents("php://input"));
$receivedId = isset($data->receivedId) ? intval($data->receivedId) : 0;
$locationId = isset($data->locationId) ? $data->locationId : '';

if ($receivedId <= 0 || empty($locationId)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid data provided."]);
    exit();
}

$conn->begin_transaction();

try {
    // 1. Get the received part details
    $stmt_get = $conn->prepare("SELECT * FROM receivedparts WHERE id = ?");
    if ($stmt_get === false) { throw new Exception("Failed to prepare statement to get received part."); }
    $stmt_get->bind_param("i", $receivedId);
    if (!$stmt_get->execute()) { throw new Exception("Failed to execute query to get received part."); }
    
    $received_result = $stmt_get->get_result();
    if ($received_result->num_rows === 0) {
        throw new Exception("Received part record not found for ID: " . $receivedId);
    }
    $received = $received_result->fetch_assoc();
    $stmt_get->close();

    $part_id = $received['partId'];
    $quantity = $received['quantity'];
    $partName = '';

    if ($part_id) { // If it's an existing part
        $stmt_update = $conn->prepare("UPDATE parts SET quantity = quantity + ?, locationId = ? WHERE id = ?");
        if ($stmt_update === false) { throw new Exception("Failed to prepare statement to update existing part."); }
        $stmt_update->bind_param("isi", $quantity, $locationId, $part_id);
        if (!$stmt_update->execute()) { throw new Exception("Failed to update part quantity."); }
        $stmt_update->close();

        $partNameStmt = $conn->prepare("SELECT name FROM parts WHERE id = ?");
        $partNameStmt->bind_param("i", $part_id);
        $partNameStmt->execute();
        $partName = $partNameStmt->get_result()->fetch_assoc()['name'];
        $partNameStmt->close();

    } else { // It's a brand new part
        $partName = $received['newPartName'];
        // Ensure required fields for a new part are present
        if (empty($received['newPartName']) || empty($received['newPartNumber'])) {
            throw new Exception("New part name and SKU are required to create a new part record.");
        }
        $stmt_insert = $conn->prepare("INSERT INTO parts (name, sku, maker, quantity, locationId, category, minQuantity) VALUES (?, ?, ?, ?, ?, 'Other', 1)");
        if ($stmt_insert === false) { throw new Exception("Failed to prepare statement to create new part."); }
        $stmt_insert->bind_param("sssis", $partName, $received['newPartNumber'], $received['newPartMaker'], $quantity, $locationId);
        if (!$stmt_insert->execute()) { throw new Exception("Failed to create new part record: " . $stmt_insert->error); }
        $part_id = $stmt_insert->insert_id;
        $stmt_insert->close();
    }

    $log_user = $_SESSION['user_fullname'];
    $log_details = "Added $quantity unit(s) to '$partName' (Part ID: $part_id).";
    $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Parts Restocked (Request)', ?)");
    $log_stmt->bind_param("ss", $log_user, $log_details);
    $log_stmt->execute();
    $log_stmt->close();
    
    $stmt_req = $conn->prepare("UPDATE partrequests SET status = 'Completed' WHERE id = ?");
    $stmt_req->bind_param("i", $received['requestId']);
    $stmt_req->execute();
    $stmt_req->close();

    $stmt_del = $conn->prepare("DELETE FROM receivedparts WHERE id = ?");
    $stmt_del->bind_param("i", $receivedId);
    $stmt_del->execute();
    $stmt_del->close();

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Parts restocked successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Restock failed: " . $e->getMessage()]);
}

$conn->close();
?>