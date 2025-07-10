<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid part ID."]);
    exit();
}

$stmt = $conn->prepare("UPDATE parts SET name=?, sku=?, category=?, quantity=?, minQuantity=?, locationId=?, maker=?, supplier=?, price=?, currency=? WHERE id=?");
$stmt->bind_param("sssiisssdsi", 
    $data->name, 
    $data->sku, 
    $data->category, 
    $data->quantity, 
    $data->minQuantity, 
    $data->locationId, 
    $data->maker, 
    $data->supplier, 
    $data->price, 
    $data->currency,
    $id
);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "Part updated successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update part."]);
}

$stmt->close();
$conn->close();
?>