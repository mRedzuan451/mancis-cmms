<?php
require_once 'auth_check.php';
require_once 'permissions_config.php';

// --- START: FIX ---

// 1. Establish the database connection FIRST.
$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { 
    http_response_code(503);
    echo json_encode(["message" => "Database connection failed."]);
    exit(); 
}

// 2. NOW call authorize() with the required $conn variable.
authorize('user_edit', $conn);

// --- END: FIX ---

$data = json_decode(file_get_contents("php://input"));
$userId = $data->userId ?? 0;
$newRole = $data->role ?? ''; // The new role is now part of the payload
$newPermissions = $data->permissions ?? [];

if ($userId <= 0 || empty($newRole)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid User ID or Role."]);
    exit();
}

$conn->begin_transaction();

try {
    // 1. Update the user's role in the 'users' table.
    $stmt_role = $conn->prepare("UPDATE users SET role = ? WHERE id = ?");
    $stmt_role->bind_param("si", $newRole, $userId);
    $stmt_role->execute();
    $stmt_role->close();

    // 2. Delete all previous permission overrides for this user.
    $stmt_delete = $conn->prepare("DELETE FROM user_permissions WHERE user_id = ?");
    $stmt_delete->bind_param("i", $userId);
    $stmt_delete->execute();
    $stmt_delete->close();

    // 3. Get the default permissions for the user's NEW role.
    $defaultPermissions = $role_permissions[$newRole] ?? [];

    // 4. Loop through submitted permissions and save overrides.
    foreach ($newPermissions as $key => $is_granted) {
        $hasDefaultPermission = in_array($key, $defaultPermissions);
        
        if ($is_granted !== $hasDefaultPermission) { // If state differs from the new role's default
            $stmt_insert = $conn->prepare("INSERT INTO user_permissions (user_id, permission_key, has_permission) VALUES (?, ?, ?)");
            $stmt_insert->bind_param("isi", $userId, $key, $is_granted);
            $stmt_insert->execute();
            $stmt_insert->close();
        }
    }

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "User permissions and role updated successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update permissions.", "error" => $e->getMessage()]);
}

$conn->close();
?>