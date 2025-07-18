<?php
// backend/delete_pm_schedule.php
require_once 'auth_check.php';
authorize('pm_schedule_delete')

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? intval($data->id) : 0;

$stmt = $conn->prepare("DELETE FROM pm_schedules WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(["message" => "PM Schedule deleted successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to delete schedule."]);
}
$stmt->close();
$conn->close();
?>