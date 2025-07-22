<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('stock_take_create', $conn);

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid ID provided."]);
    exit();
}

$sql = "SELECT st.*, u.fullName as creator_name 
        FROM stock_takes st 
        JOIN users u ON st.creator_id = u.id 
        WHERE st.id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
$session = $result->fetch_assoc();

if ($session) {
    echo json_encode($session);
} else {
    http_response_code(404);
    echo json_encode(["message" => "Session not found."]);
}

$stmt->close();
$conn->close();
?>