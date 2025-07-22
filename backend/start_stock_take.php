<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('stock_take_create', $conn);

$creator_id = $_SESSION['user_id'];
$conn->begin_transaction();

try {
    // Create the main session record
    $stmt_create = $conn->prepare("INSERT INTO stock_takes (creator_id, status) VALUES (?, 'In Progress')");
    $stmt_create->bind_param("i", $creator_id);
    $stmt_create->execute();
    $stock_take_id = $stmt_create->insert_id;
    $stmt_create->close();

    // Get all parts and add them to the session
    $parts_result = $conn->query("SELECT id, quantity FROM parts");
    $stmt_insert_item = $conn->prepare("INSERT INTO stock_take_items (stock_take_id, part_id, system_qty) VALUES (?, ?, ?)");

    while ($part = $parts_result->fetch_assoc()) {
        $stmt_insert_item->bind_param("iii", $stock_take_id, $part['id'], $part['quantity']);
        $stmt_insert_item->execute();
    }
    $stmt_insert_item->close();

    $conn->commit();
    http_response_code(201);
    echo json_encode(["message" => "New stock take session started.", "id" => $stock_take_id]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to start stock take session.", "error" => $e->getMessage()]);
}

$conn->close();
?>