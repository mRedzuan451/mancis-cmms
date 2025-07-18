<?php
require_once 'auth_check.php';
require_once 'permissions_config.php';
authorize(['Admin']);

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));
$userId = $data->userId ?? 0;
$newPermissions = $data->permissions ?? [];

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid User ID."]);
    exit();
}

$conn->begin_transaction();

try {
    // 1. Get the user's role to compare against defaults.
    $stmt_role = $conn->prepare("SELECT role FROM users WHERE id = ?");
    $stmt_role->bind_param("i", $userId);
    $stmt_role->execute();
    $user = $stmt_role->get_result()->fetch_assoc();
    if (!$user) { throw new Exception("User not found."); }
    $userRole = $user['role'];
    $stmt_role->close();

    // 2. Delete all previous permission overrides for this user.
    $stmt_delete = $conn->prepare("DELETE FROM user_permissions WHERE user_id = ?");
    $stmt_delete->bind_param("i", $userId);
    $stmt_delete->execute();
    $stmt_delete->close();

    // 3. Get the default permissions for this user's role.
    $defaultPermissions = $role_permissions[$userRole] ?? [];

    // 4. Loop through the submitted permissions and save only the ones that differ from the default.
    foreach ($newPermissions as $key => $is_granted) {
        $hasDefaultPermission = in_array($key, $defaultPermissions);
        
        // If the submitted permission state is DIFFERENT from the role's default, it's an override.
        if ($is_granted !== $hasDefaultPermission) {
            $stmt_insert = $conn->prepare("INSERT INTO user_permissions (user_id, permission_key, has_permission) VALUES (?, ?, ?)");
            $stmt_insert->bind_param("isi", $userId, $key, $is_granted);
            $stmt_insert->execute();
            $stmt_insert->close();
        }
    }

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "User permissions updated successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update permissions.", "error" => $e->getMessage()]);
}

$conn->close();
?>