<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// Use the 'asset_edit' permission key for this action
authorize('asset_edit', $conn);

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0 || empty($data->name)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid asset ID or incomplete data."]);
    exit();
}

// --- START: FIX ---

// 1. Fetch the current asset to get its existing status
$stmt_get = $conn->prepare("SELECT status FROM assets WHERE id = ?");
$stmt_get->bind_param("i", $id);
$stmt_get->execute();
$current_asset = $stmt_get->get_result()->fetch_assoc();
if (!$current_asset) {
    http_response_code(404);
    echo json_encode(["message" => "Asset not found."]);
    exit();
}
$stmt_get->close();

// 2. Determine the new status.
// If a status is provided in the request (from the Decommission button), use it.
// Otherwise, keep the current status (for the Edit Asset modal).
$status = isset($data->status) ? $data->status : $current_asset['status'];

$relatedPartsJson = isset($data->relatedParts) ? json_encode($data->relatedParts) : null;

// 3. Update the SQL query to include the 'status' column
$stmt = $conn->prepare("UPDATE assets SET name=?, tag=?, category=?, locationId=?, purchaseDate=?, cost=?, currency=?, relatedParts=?, status=? WHERE id=?");
$stmt->bind_param("sssssdsssi", // Added 's' for the status string
    $data->name, 
    $data->tag, 
    $data->category, 
    $data->locationId, 
    $data->purchaseDate, 
    $data->cost, 
    $data->currency,
    $relatedPartsJson,
    $status, // Pass the new status to the query
    $id
);

// --- END: FIX ---

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