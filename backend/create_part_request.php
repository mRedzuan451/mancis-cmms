<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_request_create', $conn);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$data = json_decode(file_get_contents("php://input"));

if (empty($data->quantity) || empty($data->requesterId) || empty($data->status)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data for Part Request."]);
    exit();
}

$conn->begin_transaction();

try {
    $stmt = $conn->prepare("INSERT INTO partrequests (partId, quantity, purpose, requesterId, requestDate, status, notes, newPartName, newPartNumber, newPartMaker) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("iissssssss",
        $data->partId,
        $data->quantity,
        $data->purpose,
        $data->requesterId,
        $data->requestDate,
        $data->status,
        $data->notes,
        $data->newPartName,
        $data->newPartNumber,
        $data->newPartMaker
    );

    if ($stmt->execute()) {
        $new_request_id = $stmt->insert_id;

        // --- START: Notification Logic ---
        // 1. Get all managers
        $manager_sql = "SELECT id FROM users WHERE role = 'Manager'";
        $manager_result = $conn->query($manager_sql);
        
        // 2. Create a notification for each manager
        if ($manager_result->num_rows > 0) {
            $notification_message = "New part request (#" . $new_request_id . ") submitted by " . $_SESSION['user_fullname'];
            $notification_stmt = $conn->prepare("INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, 'part_request_new', ?, ?)");
            
            while ($manager = $manager_result->fetch_assoc()) {
                $notification_stmt->bind_param("isi", $manager['id'], $notification_message, $new_request_id);
                $notification_stmt->execute();
            }
            $notification_stmt->close();
        }
        // --- END: Notification Logic ---

        $conn->commit();
        http_response_code(201);
        echo json_encode(["message" => "Part Request submitted successfully."]);
    } else {
        throw new Exception("Failed to submit Part Request.");
    }
    $stmt->close();

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => $e->getMessage(), "error" => $stmt->error]);
}

$conn->close();
?>