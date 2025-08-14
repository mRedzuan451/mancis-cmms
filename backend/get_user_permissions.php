<?php
require_once 'auth_check.php';
require_once 'permissions_config.php';

header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
$conn = getDbConnection();

$userId = $_GET['user_id'] ?? 0;

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid User ID."]);
    exit();
}

try {
    // 1. Get the user's role.
    $stmt_role = $conn->prepare("SELECT role FROM users WHERE id = ?");
    $stmt_role->bind_param("i", $userId);
    $stmt_role->execute();
    $user = $stmt_role->get_result()->fetch_assoc();
    if (!$user) { throw new Exception("User not found."); }
    $userRole = $user['role'];
    $stmt_role->close();

    // 2. Get the default permissions for that role from the config file.
    $defaultPermissions = $role_permissions[$userRole] ?? [];

    // 3. Get the specific overrides for this user from the database.
    $stmt_perms = $conn->prepare("SELECT permission_key, has_permission FROM user_permissions WHERE user_id = ?");
    $stmt_perms->bind_param("i", $userId);
    $stmt_perms->execute();
    $overrides_result = $stmt_perms->get_result();
    
    $overrides = [];
    while($row = $overrides_result->fetch_assoc()) {
        $overrides[$row['permission_key']] = (bool)$row['has_permission'];
    }
    $stmt_perms->close();

    // 4. Combine defaults and overrides to create the final, effective permission set.
    $final_permissions = [];
    foreach ($permissions as $key => $label) {
        if (isset($overrides[$key])) {
            $final_permissions[$key] = $overrides[$key]; // Override takes precedence
        } else {
            $final_permissions[$key] = in_array($key, $defaultPermissions); // Fallback to role default
        }
    }

    echo json_encode($final_permissions);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Failed to fetch user permissions.", "error" => $e->getMessage()]);
}

$conn->close();
?>