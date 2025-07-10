<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

if (empty($data->name) || empty($data->sku) || empty($data->locationId)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Name, SKU, and Location are required."]);
    exit();
}

$stmt = $conn->prepare("INSERT INTO parts (name, sku, category, quantity, minQuantity, locationId, maker, supplier, price, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("sssiisssds", 
    $data->name, 
    $data->sku, 
    $data->category, 
    $data->quantity, 
    $data->minQuantity, 
    $data->locationId, 
    $data->maker, 
    $data->supplier, 
    $data->price, 
    $data->currency
);

if ($stmt->execute()) {
    $new_id = $conn->insert_id;
    $data->id = $new_id;
    http_response_code(201);
    echo json_encode($data);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create part."]);
}

$stmt->close();
$conn->close();
?>