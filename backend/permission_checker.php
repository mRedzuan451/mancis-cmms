<?php
// This file contains a reusable function to get the final permissions for any user.

function getEffectivePermissions($userId, $conn) {
    require_once 'permissions_config.php'; // Needs the master lists

    // 1. Get the user's role from the database.
    $stmt_role = $conn->prepare("SELECT role FROM users WHERE id = ?");
    $stmt_role->bind_param("i", $userId);
    $stmt_role->execute();
    $user_result = $stmt_role->get_result()->fetch_assoc();
    if (!$user_result) { return []; } 
    $userRoleFromDb = $user_result['role'];
    $stmt_role->close();

    // --- START: FIX ---
    // 2. Find the correctly-cased role key from the config file to prevent case-sensitivity issues.
    $roleKey = null;
    foreach (array_keys($role_permissions) as $key) {
        if (strtolower($key) === strtolower($userRoleFromDb)) {
            $roleKey = $key;
            break;
        }
    }
    // Use the correctly cased key to get the default permissions. If not found, default to an empty array.
    $defaultPermissions = $roleKey ? $role_permissions[$roleKey] : [];
    // --- END: FIX ---

    // 3. Get the specific overrides for this user from the user_permissions table.
    $stmt_perms = $conn->prepare("SELECT permission_key, has_permission FROM user_permissions WHERE user_id = ?");
    $stmt_perms->bind_param("i", $userId);
    $stmt_perms->execute();
    $overrides_result = $stmt_perms->get_result();
    
    $overrides = [];
    while($row = $overrides_result->fetch_assoc()) {
        $overrides[$row['permission_key']] = (bool)$row['has_permission'];
    }
    $stmt_perms->close();

    // 4. Combine defaults and overrides to create the final permission set.
    $final_permissions = [];
    // The `$permissions` variable comes from permissions_config.php
    foreach ($permissions as $key => $label) {
        if (isset($overrides[$key])) {
            $final_permissions[$key] = $overrides[$key]; // Override takes precedence
        } else {
            $final_permissions[$key] = in_array($key, $defaultPermissions); // Fallback to role default
        }
    }
    
    return $final_permissions;
}
?>