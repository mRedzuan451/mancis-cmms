<?php
require_once 'auth_check.php';

date_default_timezone_set('Asia/Kuala_Lumpur');

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

if (empty($data->partId) || empty($data->quantity)) {
    http_response_code(400);
    echo json_encode(["message" => "Part ID and quantity are required."]);
    exit();
}

$partId = intval($data->partId);
$quantity = intval($data->quantity);
$requesterId = $_SESSION['user_id'];
$purpose = "Automatic restock due to low inventory";
$status = "Requested";
$requestDate = date("Y-m-d");

$conn->begin_transaction();

try {
    // --- START: FIX ---
    // 1. Check if an open request already exists for this part.
    // An open request is one that is not yet 'Completed' or 'Rejected'.
    $open_statuses = "'Requested', 'Approved', 'Received', 'Requested from Storage'";
    $stmt_check = $conn->prepare("SELECT id FROM partrequests WHERE partId = ? AND status IN ($open_statuses)");
    $stmt_check->bind_param("i", $partId);
    $stmt_check->execute();
    $result = $stmt_check->get_result();

    if ($result->num_rows > 0) {
        // 2. If a request exists, do nothing and report success to prevent the frontend from showing an error.
        $stmt_check->close();
        http_response_code(200); // OK, not 201 Created
        echo json_encode(["message" => "An open request already exists for part ID: " . $partId]);
    } else {
        // 3. If no request exists, create a new one.
        $stmt_check->close();
        $stmt_insert = $conn->prepare("INSERT INTO partrequests (partId, quantity, purpose, requesterId, requestDate, status) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt_insert->bind_param("iisiss", $partId, $quantity, $purpose, $requesterId, $requestDate, $status);
        $stmt_insert->execute();
        $stmt_insert->close();
        http_response_code(201);
        echo json_encode(["message" => "Automatic part request created successfully for part ID: " . $partId]);
    }
    // --- END: FIX ---

    $conn->commit();

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "An error occurred during automatic request creation.", "error" => $e->getMessage()]);
}

$conn->close();
?>