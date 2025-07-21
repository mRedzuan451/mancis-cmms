<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_edit', $conn);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$data = json_decode(file_get_contents("php://input"));

$quantity = isset($data->quantity) ? intval($data->quantity) : 0;
$locationId = isset($data->locationId) ? $data->locationId : '';
$notes = isset($data->notes) ? $data->notes : 'Direct restock';

$conn->begin_transaction();

try {
    $log_details = '';
    $log_user = $_SESSION['user_fullname'];

    if (isset($data->partId) && !empty($data->partId)) {
        $partId = intval($data->partId);

        if ($partId <= 0 || $quantity <= 0 || empty($locationId)) {
            throw new Exception("Part, quantity, and location are required for existing parts.");
        }

        $stmt = $conn->prepare("UPDATE parts SET quantity = quantity + ?, locationId = ? WHERE id = ?");
        $stmt->bind_param("isi", $quantity, $locationId, $partId);
        $stmt->execute();

        if ($stmt->affected_rows === 0) { throw new Exception("Part not found or failed to update."); }
        $stmt->close();

        $stmt_log = $conn->prepare("SELECT name FROM parts WHERE id = ?");
        $stmt_log->bind_param("i", $partId);
        $stmt_log->execute();
        $part = $stmt_log->get_result()->fetch_assoc();
        $partName = $part['name'] ?? 'Unknown Part';
        $stmt_log->close();
        
        $log_details = "Added $quantity unit(s) to '$partName' (Part ID: $partId). Notes: $notes";

    } elseif (isset($data->newPartName) && !empty($data->newPartName)) {
        if (empty($data->newPartSku) || $quantity <= 0 || empty($locationId)) {
            throw new Exception("New part name, SKU, quantity, and location are required.");
        }
        
        $stmt = $conn->prepare("INSERT INTO parts (name, sku, maker, category, quantity, locationId) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssssis", 
            $data->newPartName,
            $data->newPartSku,
            $data->newPartMaker,
            $data->newPartCategory,
            $quantity,
            $locationId
        );
        $stmt->execute();
        $newPartId = $stmt->insert_id;
        $stmt->close();
        
        $log_details = "Created and stocked new part '$data->newPartName' (ID: $newPartId) with $quantity unit(s). Notes: $notes";

    } else {
        throw new Exception("Invalid data provided for restock.");
    }

    $log_stmt = $conn->prepare("INSERT INTO logs (user, action, details) VALUES (?, 'Direct Part Restock', ?)");
    $log_stmt->bind_param("ss", $log_user, $log_details);
    $log_stmt->execute();
    $log_stmt->close();

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Part restocked successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Restock failed: " . $e->getMessage()]);
}

$conn->close();
?>