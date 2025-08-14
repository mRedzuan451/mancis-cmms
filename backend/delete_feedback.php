<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('feedback_delete', $conn);

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid feedback ID."]);
    exit();
}

$conn->begin_transaction();
try {
    // 1. Delete all statuses related to this feedback message
    $stmt1 = $conn->prepare("DELETE FROM feedback_read_status WHERE feedback_id = ?");
    $stmt1->bind_param("i", $id);
    $stmt1->execute();
    $stmt1->close();

    // 2. Delete the main feedback message
    $stmt2 = $conn->prepare("DELETE FROM feedback WHERE id = ?");
    $stmt2->bind_param("i", $id);
    $stmt2->execute();

    if ($stmt2->affected_rows > 0) {
        $conn->commit();
        http_response_code(200);
        echo json_encode(["message" => "Feedback deleted successfully."]);
    } else {
        $conn->rollback();
        http_response_code(404);
        echo json_encode(["message" => "Feedback message not found."]);
    }
    $stmt2->close();

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to delete feedback.", "error" => $e->getMessage()]);
}

$conn->close();
?>