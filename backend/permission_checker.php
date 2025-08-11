<?php
// This file contains reusable functions to check user permissions.

/**
 * Checks if the current user has a specific permission without exiting the script.
 * @param string $permission_key The permission to check.
 * @param mysqli $conn The database connection.
 * @return bool True if the user has permission, false otherwise.
 */
function has_permission($permission_key, $conn) {
    if (!isset($_SESSION['user_id'])) {
        return false;
    }
    if (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'Admin') {
        return true; // Admins always have permission
    }
    
    // Get all effective permissions for the user
    $currentUserPermissions = getEffectivePermissions($_SESSION['user_id'], $conn);

    // Return true only if the key exists and its value is true
    return !empty($currentUserPermissions[$permission_key]);
}

/**
 * Calculates the final, effective permission set for a user by combining role defaults and individual overrides.
 * @param int $userId The user's ID.
 * @param mysqli $conn The database connection.
 * @return array The user's final permission set.
 */
function getEffectivePermissions($userId, $conn) {
    require 'permissions_config.php'; // Needs the master lists

    // 1. Get the user's role from the database.
    $stmt_role = $conn->prepare("SELECT role FROM users WHERE id = ?");
    $stmt_role->bind_param("i", $userId);
    $stmt_role->execute();
    $user_result = $stmt_role->get_result()->fetch_assoc();
    if (!$user_result) { return []; } 
    $userRoleFromDb = $user_result['role'];
    $stmt_role->close();

    $roleKey = null;
    foreach (array_keys($role_permissions) as $key) {
        if (strtolower($key) === strtolower($userRoleFromDb)) {
            $roleKey = $key;
            break;
        }
    }
    $defaultPermissions = $roleKey ? $role_permissions[$roleKey] : [];

    // 3. Get specific overrides for this user from the user_permissions table.
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