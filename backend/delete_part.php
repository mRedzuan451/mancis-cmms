<?php

require_once 'auth_check.php';

authorize('part_delete');

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid part ID."]);
    exit();
}

$stmt = $conn->prepare("DELETE FROM parts WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        http_response_code(200);
        echo json_encode(["message" => "Part deleted successfully."]);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Part not found."]);
    }
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to delete part."]);
}

$stmt->close();
$conn->close();
?>