<?php
require_once 'auth_check.php';
require_once 'permissions_config.php'; // Includes $permissions and $role_permissions

// It's good practice to secure this endpoint.
// The database connection is now required for the authorize function.
$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { 
    http_response_code(503);
    echo json_encode(["message"=> "Database connection failed."]);
    exit();
}

// Only allow users who can edit other users to see the permissions structure.
authorize('user_edit', $conn);

header("Content-Type: application/json; charset=UTF-8");

// Return an object containing both the master list and the role defaults
echo json_encode([
    'all'   => $permissions,
    'roles' => $role_permissions
]);

$conn->close();
?>