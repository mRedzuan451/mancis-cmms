<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_create', $conn);

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));

if (empty($data->name) || empty($data->sku) || empty($data->locationId)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Name, SKU, and Location are required."]);
    exit();
}

$relatedAssetsJson = isset($data->relatedAssets) ? json_encode($data->relatedAssets) : null;

$stmt = $conn->prepare("INSERT INTO parts (name, sku, category, quantity, minQuantity, locationId, maker, supplier, price, currency, relatedAssets) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("sssiisssdss", 
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
    $relatedAssetsJson
);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Part created successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create part."]);
}

$stmt->close();
$conn->close();
?>