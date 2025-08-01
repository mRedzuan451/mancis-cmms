<?php
require_once 'auth_check.php';
require_once 'location_helper.php'; // Include the new helper

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('asset_create', $conn);

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));

if (empty($data->name) || empty($data->tag) || empty($data->locationId)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Name, Tag, and Location are required."]);
    exit();
}

// --- START: MODIFICATION ---
$relatedPartsJson = isset($data->relatedParts) ? json_encode($data->relatedParts) : '[]';
$departmentId = getDepartmentIdFromLocation($data->locationId, $conn); // Get the department ID

$stmt = $conn->prepare("INSERT INTO assets (name, tag, category, locationId, departmentId, purchaseDate, cost, currency, status, relatedParts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)");
$stmt->bind_param("ssssisdss", 
    $data->name, 
    $data->tag, 
    $data->category, 
    $data->locationId,
    $departmentId, // Add it to the insert statement
    $data->purchaseDate, 
    $data->cost, 
    $data->currency,
    $relatedPartsJson
);
// --- END: MODIFICATION ---

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => "Asset created successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create asset.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>