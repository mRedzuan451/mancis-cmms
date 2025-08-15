<?php
require_once 'auth_check.php';
require_once 'location_helper.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('part_edit', $conn);

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data)) {
    http_response_code(400);
    echo json_encode(["message" => "No data provided."]);
    exit();
}

$conn->begin_transaction();

$created = 0;
$updated = 0;
$failed = 0;
$errors = [];

try {
    $existing_skus_result = $conn->query("SELECT id, sku FROM parts");
    $existing_skus = [];
    while ($row = $existing_skus_result->fetch_assoc()) {
        $existing_skus[$row['sku']] = $row['id'];
    }

    foreach ($data as $index => $part) {
        $rowNum = $index + 2;

        if (empty($part['sku']) || empty($part['name'])) {
            $failed++;
            $errors[] = "Row $rowNum: Missing required field 'sku' or 'name'.";
            continue;
        }

        $sku = trim($part['sku']);

        $departmentId = getDepartmentIdFromLocation($part['locationId'], $conn); // Calculate departmentId

        if (isset($existing_skus[$sku])) {
            // --- UPDATE ---
            $id = $existing_skus[$sku];
            // Add departmentId to the UPDATE statement
            $stmt = $conn->prepare("UPDATE parts SET name=?, category=?, quantity=?, minQuantity=?, locationId=?, maker=?, supplier=?, price=?, currency=?, departmentId=? WHERE id=?");
            $stmt->bind_param("ssiisssdiii",
                $part['name'], $part['category'], $part['quantity'], $part['minQuantity'],
                $part['locationId'], $part['maker'], $part['supplier'],
                $part['price'], $part['currency'], $departmentId, $id
            );
            if ($stmt->execute()) {
                $updated++;
            } else {
                $failed++;
                $errors[] = "Row $rowNum: Failed to update part with SKU '$sku'.";
            }
            $stmt->close();
        } else {
            // --- CREATE ---
            // Add departmentId to the INSERT statement
            $stmt = $conn->prepare("INSERT INTO parts (sku, name, category, quantity, minQuantity, locationId, maker, supplier, price, currency, departmentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("sssiisssdii",
                $sku, $part['name'], $part['category'], $part['quantity'], $part['minQuantity'],
                $part['locationId'], $part['maker'], $part['supplier'],
                $part['price'], $part['currency'], $departmentId
            );
            if ($stmt->execute()) {
                $created++;
            } else {
                $failed++;
                $errors[] = "Row $rowNum: Failed to create new part with SKU '$sku'.";
            }
            $stmt->close();
        }
    }

    if ($failed > 0) {
        throw new Exception("Some rows failed to process.");
    }

    $conn->commit();
    http_response_code(200);
    echo json_encode([
        "message" => "Spare part list updated successfully.",
        "created" => $created,
        "updated" => $updated,
        "failed" => $failed
    ]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode([
        "message" => "Upload process failed. No changes were saved.",
        "created" => 0, "updated" => 0, "failed" => count($data),
        "errors" => $errors
    ]);
}

$conn->close();
?>