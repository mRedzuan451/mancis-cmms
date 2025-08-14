<?php
require_once 'auth_check.php';
require_once 'location_helper.php'; // Include the helper

require_once 'database.php';
$conn = getDbConnection();

authorize('part_edit', $conn);

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : (isset($_GET['id']) ? intval($_GET['id']) : 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid part ID."]);
    exit();
}

// --- START: MODIFICATION ---
$relatedAssetsJson = isset($data->relatedAssets) ? json_encode($data->relatedAssets) : '[]';
$departmentId = getDepartmentIdFromLocation($data->locationId, $conn); // Get the new department ID

$stmt = $conn->prepare("UPDATE parts SET name=?, sku=?, category=?, quantity=?, minQuantity=?, locationId=?, departmentId=?, maker=?, supplier=?, price=?, currency=?, relatedAssets=?, attachmentRef=? WHERE id=?");
$stmt->bind_param("sssiisisssdssi", 
    $data->name, 
    $data->sku, 
    $data->category, 
    $data->quantity, 
    $data->minQuantity, 
    $data->locationId, 
    $departmentId, // Add it to the update statement
    $data->maker, 
    $data->supplier, 
    $data->price, 
    $data->currency,
    $relatedAssetsJson,
    $data->attachmentRef,
    $id
);
// --- END: MODIFICATION ---

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "Part updated successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to update part.", "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>