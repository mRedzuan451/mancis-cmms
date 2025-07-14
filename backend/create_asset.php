<?php

// 1. REQUIRE THE AUTH CHECK AT THE VERY TOP
require_once 'auth_check.php';

// 2. AUTHORIZE SPECIFIC ROLES
// Only these roles can create an asset.
authorize(['Admin', 'Manager', 'Supervisor']);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

// Basic validation
if (empty($data->name) || empty($data->tag) || empty($data->locationId)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Name, Tag, and Location are required."]);
    exit();
}

$stmt = $conn->prepare("INSERT INTO assets (name, tag, category, locationId, purchaseDate, cost, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')");
$stmt->bind_param("sssssds", 
    $data->name, 
    $data->tag, 
    $data->category, 
    $data->locationId, 
    $data->purchaseDate, 
    $data->cost, 
    $data->currency
);

if ($stmt->execute()) {
    $new_id = $conn->insert_id;
    $data->id = $new_id;
    $data->status = 'Active';
    http_response_code(201); // Created
    echo json_encode($data);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create asset."]);
}

$stmt->close();
$conn->close();
?>