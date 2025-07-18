<?php

require_once 'auth_check.php';

authorize('asset_delete');

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST"); // Using POST for delete

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid asset ID."]);
    exit();
}

// Start a transaction
$conn->begin_transaction();

try {
    // Delete associated work orders first
    $stmt1 = $conn->prepare("DELETE FROM workOrders WHERE assetId = ?");
    $stmt1->bind_param("i", $id);
    $stmt1->execute();
    $stmt1->close();

    // Delete the asset itself
    $stmt2 = $conn->prepare("DELETE FROM assets WHERE id = ?");
    $stmt2->bind_param("i", $id);
    $stmt2->execute();
    
    if ($stmt2->affected_rows > 0) {
        // Commit transaction if everything was successful
        $conn->commit();
        http_response_code(200);
        echo json_encode(["message" => "Asset and associated work orders deleted successfully."]);
    } else {
        // Rollback if the asset was not found or couldn't be deleted
        $conn->rollback();
        http_response_code(404);
        echo json_encode(["message" => "Asset not found."]);
    }
    $stmt2->close();

} catch (mysqli_sql_exception $exception) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to delete asset.", "error" => $exception->getMessage()]);
}

$conn->close();
?>