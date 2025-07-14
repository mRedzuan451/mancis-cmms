<?php
// --- Reusable Authentication & Authorization Check ---

// Start the session to access session variables
session_start();

// Set secure CORS headers for all protected files
header("Access-Control-Allow-Origin: http://localhost");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Immediately stop execution if the user is not logged in.
if (!isset($_SESSION['user_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(["message" => "Authentication required. Please log in."]);
    exit(); // Stop the script
}

/**
 * A helper function to check if the logged-in user has the required role.
 * If the user's role is not in the allowed list, the script will stop.
 * @param array $allowedRoles An array of roles that are allowed to access the script.
 * Example: ['Admin', 'Manager']
 */
function authorize(array $allowedRoles) {
    // Admins are always authorized.
    if (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'Admin') {
        return;
    }
    
    // Check if the user's role is in the list of allowed roles.
    if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], $allowedRoles)) {
        http_response_code(403); // Forbidden
        echo json_encode(["message" => "You do not have permission to perform this action."]);
        exit(); // Stop the script
    }
}
?>