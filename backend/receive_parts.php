<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$requestId = isset($data->requestId) ? intval($data->requestId) : 0;
$receiverId = isset($data->receiverId) ? intval($data->receiverId) : 0;

if ($requestId <= 0 || $receiverId <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid data provided."]);
    exit();
}

$conn->begin_transaction();

try {
    // 1. Get the request details
    $stmt_get = $conn->prepare("SELECT * FROM partrequests WHERE id = ? AND status = 'Approved'");
    $stmt_get->bind_param("i", $requestId);
    $stmt_get->execute();
    $request_result = $stmt_get->get_result();
    if ($request_result->num_rows === 0) {
        throw new Exception("Approved request not found.");
    }
    $request = $request_result->fetch_assoc();
    $stmt_get->close();

    // 2. Update the request status to 'Received'
    $stmt_update = $conn->prepare("UPDATE partrequests SET status = 'Received' WHERE id = ?");
    $stmt_update->bind_param("i", $requestId);
    $stmt_update->execute();
    $stmt_update->close();

    // 3. Add to the receivedparts table
    $stmt_insert = $conn->prepare("INSERT INTO receivedparts (partId, quantity, requestId, receivedDate, receiverId, newPartName, newPartNumber, newPartMaker) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)");
    $stmt_insert->bind_param("iiissss", $request['partId'], $request['quantity'], $requestId, $receiverId, $request['newPartName'], $request['newPartNumber'], $request['newPartMaker']);
    $stmt_insert->execute();
    $stmt_insert->close();

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Parts marked as received."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => $e->getMessage()]);
}

$conn->close();
?>