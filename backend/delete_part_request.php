<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_request_delete', $conn);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

// --- START: MODIFICATION ---
// Read the ID from the URL parameter for consistency with other delete scripts.
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
// --- END: MODIFICATION ---

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