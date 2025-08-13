<?php
require_once 'auth_check.php';
require_once 'location_helper.php'; // <-- ADD THIS LINE

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('asset_edit', $conn);

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
    // Fetch all existing asset tags for quick lookup
    $existing_tags_result = $conn->query("SELECT id, tag FROM assets");
    $existing_tags = [];
    while ($row = $existing_tags_result->fetch_assoc()) {
        $existing_tags[$row['tag']] = $row['id'];
    }

    foreach ($data as $index => $asset) {
        $rowNum = $index + 2; // CSV row number (accounting for header)

        if (empty($asset['tag']) || empty($asset['name']) || empty($asset['locationId'])) {
            $failed++;
            $errors[] = "Row $rowNum: Missing required field 'tag', 'name', or 'locationId'.";
            continue;
        }

        $tag = trim($asset['tag']);
        // --- START: MODIFICATION ---
        $departmentId = getDepartmentIdFromLocation($asset['locationId'], $conn); // Calculate departmentId

        if (isset($existing_tags[$tag])) {
            // --- UPDATE ---
            $id = $existing_tags[$tag];
            // Add departmentId to the UPDATE statement
            $stmt = $conn->prepare("UPDATE assets SET name=?, category=?, locationId=?, purchaseDate=?, cost=?, currency=?, status=?, departmentId=? WHERE id=?");
            $stmt->bind_param("ssssdssii", 
                $asset['name'], $asset['category'], $asset['locationId'], 
                $asset['purchaseDate'], $asset['cost'], $asset['currency'], 
                $asset['status'], $departmentId, $id
            );
            if ($stmt->execute()) {
                $updated++;
            } else {
                $failed++;
                $errors[] = "Row $rowNum: Failed to update asset with tag '$tag'.";
            }
            $stmt->close();
        } else {
            // --- CREATE ---
            // Add departmentId and purchaseDate to the INSERT statement
            $stmt = $conn->prepare("INSERT INTO assets (tag, name, category, locationId, purchaseDate, cost, currency, status, departmentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("sssssdssi",
                $tag, $asset['name'], $asset['category'], $asset['locationId'],
                $asset['purchaseDate'], $asset['cost'], $asset['currency'], $asset['status'], $departmentId
            );
            // --- END: MODIFICATION ---
            if ($stmt->execute()) {
                $created++;
            } else {
                $failed++;
                $errors[] = "Row $rowNum: Failed to create new asset with tag '$tag'.";
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
        "message" => "Asset list updated successfully.",
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