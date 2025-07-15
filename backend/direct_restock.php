<?php
// backend/direct_restock.php

require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor', 'Clerk']); // Define who can do this

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

$partId = isset($data->partId) ? intval($data->partId) : 0;
$quantity = isset($data->quantity) ? intval($data->quantity) : 0;
$locationId = isset($data->locationId) ? $data->locationId : null;
$notes = isset($data->notes) ? $data->notes : 'Direct restock';

if ($partId <= 0 || $quantity <= 0 || empty($locationId)) {
    http_response_code(400);
    echo json_encode(["message" => "Part, quantity, and location are required."]);
    exit();
}

// Start a transaction
$conn->begin_transaction();

try {
    // Update the quantity and location for the existing part
    $stmt = $conn->prepare("UPDATE parts SET quantity = quantity + ?, locationId = ? WHERE id = ?");
    $stmt->bind_param("isi", $quantity, $locationId, $partId);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        throw new Exception("Part not found or failed to update.");
    }
    $stmt->close();
    
    // Log this important action for auditing
    $log_user = $_SESSION['user_fullname'];
    $log_part_name_query = "SELECT name FROM parts WHERE id = ?";
    $stmt_log = $conn->prepare($log_part_name_query);
    $stmt_log->bind_param("i", $partId);
    $stmt_log->execute();
    $result = $stmt_log->get_result();
    $part = $result->fetch_assoc();
    $partName = $part['name'] ?? 'Unknown Part';
    $stmt_log->close();
    
    $log_details = "Added $quantity unit(s) to '$partName' (Part ID: $partId). Notes: $notes";
    $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Direct Part Restock', ?)");
    $log_stmt->bind_param("ss", $log_user, $log_details);
    $log_stmt->execute();
    $log_stmt->close();

    // Commit the transaction
    $conn->commit();

    http_response_code(200);
    echo json_encode(["message" => "Part restocked successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Restock failed: " . $e->getMessage()]);
}

$conn->close();
?>