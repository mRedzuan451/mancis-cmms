<?php
require_once 'auth_check.php';

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

        if (empty($asset['tag']) || empty($asset['name'])) {
            $failed++;
            $errors[] = "Row $rowNum: Missing required field 'tag' or 'name'.";
            continue;
        }

        $tag = trim($asset['tag']);

        if (isset($existing_tags[$tag])) {
            // --- UPDATE ---
            $id = $existing_tags[$tag];
            $stmt = $conn->prepare("UPDATE assets SET name=?, category=?, locationId=?, purchaseDate=?, cost=?, currency=?, status=? WHERE id=?");
            $stmt->bind_param("ssssdssi", 
                $asset['name'], $asset['category'], $asset['locationId'], 
                $asset['purchaseDate'], $asset['cost'], $asset['currency'], 
                $asset['status'], $id
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
            $stmt = $conn->prepare("INSERT INTO assets (tag, name, category, locationId, purchaseDate, cost, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("sssssdss",
                $tag, $asset['name'], $asset['category'], $asset['locationId'],
                $asset['purchaseDate'], $asset['cost'], $asset['currency'], $asset['status']
            );
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