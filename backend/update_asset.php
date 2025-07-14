<?php

require_once 'auth_check.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST"); // Using POST to handle update

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0 || empty($data->name)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid asset ID or incomplete data."]);
    exit();
}

$stmt = $conn->prepare("UPDATE assets SET name=?, tag=?, category=?, locationId=?, purchaseDate=?, cost=?, currency=? WHERE id=?");
$stmt->bind_param("sssssdsi", 
    $data->name, 
    $data->tag, 
    $data->category, 
    $data->locationId, 
    $data->purchaseDate, 
    $data->cost, 
    $data->currency,
    $id
);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "Asset updated successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update asset."]);
}

$stmt->close();
$conn->close();
?>