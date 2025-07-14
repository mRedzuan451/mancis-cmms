<?php
// --- Reusable Authentication & Authorization Check ---

// Use your server's actual IP address here
$allowed_origin = "http://192.168.141.42";

// --- Handle browser preflight 'OPTIONS' requests ---
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Origin: " . $allowed_origin);
    header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
    header("Access-Control-Allow-Credentials: true");
    http_response_code(200);
    exit();
}

session_start();

// Set secure CORS headers for all protected files
header("Access-Control-Allow-Origin: " . $allowed_origin);
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["message" => "Authentication required. Please log in."]);
    exit();
}

function authorize(array $allowedRoles) {
    if (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'Admin') {
        return;
    }
    
    if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], $allowedRoles)) {
        http_response_code(403);
        echo json_encode(["message" => "You do not have permission to perform this action."]);
        exit();
    }
}
?>