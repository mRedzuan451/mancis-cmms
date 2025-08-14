<?php
require_once 'auth_check.php';
require_once 'location_helper.php'; // Include the new helper

require_once 'database.php';
$conn = getDbConnection();

authorize('asset_edit', $conn);

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : (isset($_GET['id']) ? intval($_GET['id']) : 0);


if ($id <= 0 || empty($data->name)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid asset ID or incomplete data."]);
    exit();
}

$stmt_get = $conn->prepare("SELECT status, locationId FROM assets WHERE id = ?");
$stmt_get->bind_param("i", $id);
$stmt_get->execute();
$current_asset = $stmt_get->get_result()->fetch_assoc();
if (!$current_asset) {
    http_response_code(404);
    echo json_encode(["message" => "Asset not found."]);
    exit();
}
$stmt_get->close();

// --- START: MODIFICATION ---
$status = isset($data->status) ? $data->status : $current_asset['status'];
$relatedPartsJson = isset($data->relatedParts) ? json_encode($data->relatedParts) : '[]';

// If location is being changed, get the new department ID
$locationId = $data->locationId ?? $current_asset['locationId'];
$departmentId = getDepartmentIdFromLocation($locationId, $conn);

$stmt = $conn->prepare("UPDATE assets SET name=?, tag=?, category=?, locationId=?, departmentId=?, purchaseDate=?, cost=?, currency=?, relatedParts=?, status=? WHERE id=?");
$stmt->bind_param("ssssisdsssi",
    $data->name, 
    $data->tag, 
    $data->category, 
    $locationId, 
    $departmentId, // Add it to the update statement
    $data->purchaseDate, 
    $data->cost, 
    $data->currency,
    $relatedPartsJson,
    $status,
    $id
);
// --- END: MODIFICATION ---


if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "Asset updated successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update asset.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>