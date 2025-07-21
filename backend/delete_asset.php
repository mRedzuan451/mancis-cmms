<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('asset_delete', $conn);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid asset ID."]);
    exit();
}

$conn->begin_transaction();

try {
    $stmt1 = $conn->prepare("DELETE FROM workOrders WHERE assetId = ?");
    $stmt1->bind_param("i", $id);
    $stmt1->execute();
    $stmt1->close();

    $stmt2 = $conn->prepare("DELETE FROM assets WHERE id = ?");
    $stmt2->bind_param("i", $id);
    $stmt2->execute();
    
    if ($stmt2->affected_rows > 0) {
        $conn->commit();
        http_response_code(200);
        echo json_encode(["message" => "Asset and associated work orders deleted successfully."]);
    } else {
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