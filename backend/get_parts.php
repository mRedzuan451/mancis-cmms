<?php

require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

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

// --- NEW: Convert the relatedAssets array to a JSON string ---
$relatedAssetsJson = isset($data->relatedAssets) ? json_encode($data->relatedAssets) : null;

$stmt = $conn->prepare("UPDATE parts SET name=?, sku=?, category=?, quantity=?, minQuantity=?, locationId=?, maker=?, supplier=?, price=?, currency=?, relatedAssets=? WHERE id=?");
// Note the new 's' for the JSON string and 'i' for the ID at the end
$stmt->bind_param("sssiisssdssi", 
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
    $relatedAssetsJson, // Bind the new JSON string
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