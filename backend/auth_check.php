<?php

// --- FINAL SESSION FIX ---

// 1. Set a dedicated, writable session path
$session_path = __DIR__ . '/sessions'; // A 'sessions' folder in the same 'backend' directory

// 2. Check if the directory exists and is writable
if (!is_dir($session_path)) {
    // Try to create it if it doesn't exist
    mkdir($session_path, 0777, true);
}

// 3. If the path is still not writable, stop and show a clear error.
if (!is_writable($session_path)) {
    header('Content-Type: application/json');
    http_response_code(500); // Internal Server Error
    echo json_encode([
        'message' => 'FATAL ERROR: The PHP session save path is not writable.',
        'path' => $session_path,
        'solution' => 'Please check the file permissions for this directory. The web server (Apache) needs to be able to write files here.'
    ]);
    exit(); // Stop the script
}

// 4. Set the session path and cookie parameters
session_save_path($session_path);
session_set_cookie_params([
    'lifetime' => 86400,    // 1 day
    'path' => '/',
    'secure' => false,      // Must be false for HTTP
    'httponly' => true,
    'samesite' => 'Lax'
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