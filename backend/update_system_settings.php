<?php
// backend/update_system_settings.php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

// Only an Admin can change system settings
if ($_SESSION['user_role'] !== 'Admin') {
    http_response_code(403);
    echo json_encode(["message" => "You do not have permission to perform this action."]);
    exit();
}

$data = json_decode(file_get_contents("php://input"));
$key = $data->key ?? '';
$value = $data->value ?? '';

if (empty($key)) {
    http_response_code(400);
    echo json_encode(['message' => 'Setting key is required.']);
    exit();
}

$stmt = $conn->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
$stmt->bind_param("sss", $key, $value, $value);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(['message' => 'Settings updated.']);
} else {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update settings.']);
}
$stmt->close();
$conn->close();
?>