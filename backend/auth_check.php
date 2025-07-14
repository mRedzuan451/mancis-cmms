<?php
// --- Reusable Authentication & Authorization Check ---

// --- NEW: Whitelist of allowed origins ---
$allowed_origins = ['http://localhost', 'http://127.0.0.1', 'http://192.168.141.42'];

// Check if the request origin is in our whitelist
if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
}

// Handle browser preflight 'OPTIONS' requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
    header("Access-Control-Allow-Credentials: true");
    http_response_code(200);
    exit();
}

// FIX: Configure the session cookie for cross-origin HTTP development
session_set_cookie_params([
    'lifetime' => 86400, // Cookie valid for 1 day
    'path' => '/',
    'domain' => '', // Set your domain if needed, otherwise leave empty
    'secure' => false, // MUST be false for HTTP
    'httponly' => true, // Good security practice
    'samesite' => 'Lax' // Use 'Lax' or 'None'. 'Lax' is safer for development.
]);

session_start();

header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

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