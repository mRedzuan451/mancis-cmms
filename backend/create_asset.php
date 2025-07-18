<?php
require_once 'auth_check.php';
authorize('asset_create');

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

if (empty($data->name) || empty($data->tag) || empty($data->locationId)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Name, Tag, and Location are required."]);
    exit();
}

$relatedPartsJson = isset($data->relatedParts) ? json_encode($data->relatedParts) : null;

$stmt = $conn->prepare("INSERT INTO assets (name, tag, category, locationId, purchaseDate, cost, currency, status, relatedParts) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?)");
$stmt->bind_param("sssssdss", 
    $data->name, 
    $data->tag, 
    $data->category, 
    $data->locationId, 
    $data->purchaseDate, 
    $data->cost, 
    $data->currency,
    $relatedPartsJson
);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Asset created successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create asset."]);
}

$stmt->close();
$conn->close();
?>