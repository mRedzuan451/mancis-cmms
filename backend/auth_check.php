<?php
// auth_check.php

// 1. SET UP CORS AND HANDLE PREFLIGHT REQUEST
$allowed_origins = ['http://localhost', 'http://127.0.0.1', 'http://192.168.141.42'];

if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
    header("Access-Control-Allow-Credentials: true");
    http_response_code(200);
    exit();
}


// 2. CONFIGURE THE SESSION COOKIE
session_set_cookie_params([
    'lifetime' => 86400,    // Cookie valid for 1 day
    'path' => '/',
    'secure' => false,      // Must be false for HTTP development
    'httponly' => true,
    'samesite' => 'Lax'
]);


// 3. START THE SESSION
session_start();


// 4. SET REMAINING HEADERS
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");


// 5. AUTHENTICATION AND AUTHORIZATION LOGIC
if (!isset($_SESSION['user_id'])) {
    http_response_code(401); 
    echo json_encode(["message" => "Authentication required. Please log in."]);
    exit();
}

function authorize(array $allowedRoles) {
    // Admins are always authorized
    if (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'Admin') {
        return;
    }
    
    if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], $allowedRoles)) {
        http_response_code(403); // Forbidden
        echo json_encode(["message" => "You do not have permission to perform this action."]);
        exit();
    }
}
?>