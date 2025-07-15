<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

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
    $stmt_get->bind_param("i", $receivedId);
    $stmt_get->execute();
    $received_result = $stmt_get->get_result();
    if ($received_result->num_rows === 0) {
        throw new Exception("Received part not found.");
    }
    $received = $received_result->fetch_assoc();
    $stmt_get->close();

    $part_id = $received['partId'];
    $quantity = $received['quantity'];
    $partName = '';

    if ($part_id) { // If it's an existing part
        $stmt_update = $conn->prepare("UPDATE parts SET quantity = quantity + ?, locationId = ? WHERE id = ?");
        $stmt_update->bind_param("isi", $quantity, $locationId, $part_id);
        $stmt_update->execute();
        $stmt_update->close();

        // Get the part name for logging
        $partNameStmt = $conn->prepare("SELECT name FROM parts WHERE id = ?");
        $partNameStmt->bind_param("i", $part_id);
        $partNameStmt->execute();
        $partName = $partNameStmt->get_result()->fetch_assoc()['name'];
        $partNameStmt->close();

    } else { // It's a brand new part
        $partName = $received['newPartName'];
        $stmt_insert = $conn->prepare("INSERT INTO parts (name, sku, maker, quantity, locationId, category) VALUES (?, ?, ?, ?, ?, 'Other')");
        $stmt_insert->bind_param("sssis", $partName, $received['newPartNumber'], $received['newPartMaker'], $quantity, $locationId);
        $stmt_insert->execute();
        $part_id = $stmt_insert->insert_id; // Get the ID of the new part for logging
        $stmt_insert->close();
    }

    // 2. CREATE A DETAILED LOG ENTRY
    $log_user = $_SESSION['user_fullname'];
    $log_details = "Added $quantity unit(s) to '$partName' (Part ID: $part_id).";
    $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Parts Restocked (Request)', ?)");
    $log_stmt->bind_param("ss", $log_user, $log_details);
    $log_stmt->execute();
    $log_stmt->close();
    
    // 3. Update the original request to 'Completed'
    $stmt_req = $conn->prepare("UPDATE partrequests SET status = 'Completed' WHERE id = ?");
    $stmt_req->bind_param("i", $received['requestId']);
    $stmt_req->execute();
    $stmt_req->close();

    // 4. Delete from the receivedparts table
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