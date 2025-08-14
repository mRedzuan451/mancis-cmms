<?php
// backend/get_system_settings.php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

$sql = "SELECT setting_key, setting_value FROM system_settings";
$result = $conn->query($sql);

$settings = [];
while($row = $result->fetch_assoc()) {
    $settings[$row['setting_key']] = $row['setting_value'];
}

echo json_encode($settings);
$conn->close();
?>