<?php
require_once 'auth_check.php';
require_once 'permissions_config.php'; // Includes $permissions and $role_permissions

// It's good practice to secure this endpoint.
// The database connection is now required for the authorize function.
require_once 'database.php';
$conn = getDbConnection();
    http_response_code(503);
    echo json_encode(["message"=> "Database connection failed."]);
    exit();
}


header("Content-Type: application/json; charset=UTF-8");

// Return an object containing both the master list and the role defaults
echo json_encode([
    'all'   => $permissions,
    'roles' => $role_permissions
]);

$conn->close();
?>