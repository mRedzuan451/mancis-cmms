<?php

function custom_log($message) {
    // This will create or append to a file named 'debug_log.txt'
    file_put_contents('debug_log.txt', date('[Y-m-d H:i:s] ') . $message . "\n", FILE_APPEND);
}
// auth_check.php - Enhanced with JSON Error Handling

// --- START: JSON ERROR HANDLER ---
// This block will catch fatal PHP errors and report them as clean JSON
// instead of sending back HTML that breaks the frontend.
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR])) {
        // If headers have already been sent, we can't do anything.
        if (headers_sent()) {
            return;
        }
        
        http_response_code(500); // Internal Server Error
        header('Content-Type: application/json; charset=UTF-8');
        
        echo json_encode([
            "message" => "A fatal server error occurred. See details.",
            "error_details" => [
                "type"    => $error['type'],
                "message" => $error['message'],
                "file"    => basename($error['file']), // Use basename for brevity/security
                "line"    => $error['line']
            ]
        ]);
        
        exit();
    }
});
// --- END: JSON ERROR HANDLER ---


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
    'lifetime' => 86400,
    'path' => '/',
    'secure' => false,
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