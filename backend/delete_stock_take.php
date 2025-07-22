<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// Authorize using the new permission key
authorize('stock_take_delete', $conn);

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid stock take ID."]);
    exit();
}

$stmt = $conn->prepare("DELETE FROM stock_takes WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        http_response_code(200);
        echo json_encode(["message" => "Stock take session deleted successfully."]);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Stock take session not found."]);
    }
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to delete session."]);
}

$stmt->close();
$conn->close();
?>