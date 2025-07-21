<?php
require_once 'auth_check.php';

// --- START: FIX ---

// 1. Establish the database connection FIRST.
$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { 
    http_response_code(503);
    echo json_encode(["message" => "Database connection failed."]);
    exit();
}

// 2. NOW call authorize() with the correct permission key and the $conn variable.
authorize('part_request_delete', $conn);

// --- END: FIX ---

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid request ID."]);
    exit();
}

$stmt = $conn->prepare("DELETE FROM partrequests WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        http_response_code(200);
        echo json_encode(["message" => "Request deleted successfully."]);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Request not found."]);
    }
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to delete request."]);
}

$stmt->close();
$conn->close();
?>