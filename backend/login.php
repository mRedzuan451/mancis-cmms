<?php
/**
 * login.php
 * Handles user authentication, session creation, and permission loading.
 * CORRECTED with full CORS and session headers.
 */

// --- START: FIX ---
// This entire block of headers and session configuration is required.

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
    'lifetime' => 86400, // 24 hours
    'path' => '/',
    'secure' => false, // Set to true if using HTTPS
    'httponly' => true,
    'samesite' => 'Lax'
]);

// 3. START THE SESSION & SET HEADERS
session_start();
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

// --- END: FIX ---

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(503);
    echo json_encode(["message" => "Database connection failed. Please contact an administrator."]);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

if (json_last_error() !== JSON_ERROR_NONE || !isset($data->username) || !isset($data->password) || empty(trim($data->username))) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid input. Username and password are required."]);
    exit();
}

$login_user = $data->username;
$login_pass = $data->password;

try {
    $stmt = $conn->prepare("SELECT id, fullName, role, departmentId, password FROM users WHERE username = ?");
    
    if ($stmt === false) {
        throw new Exception("Server error: Could not prepare the database statement.");
    }
    
    $stmt->bind_param("s", $login_user);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();
        
        if (password_verify($login_pass, $user['password'])) {
            require_once 'permission_checker.php';
            $user['permissions'] = getEffectivePermissions($user['id'], $conn);
            
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_role'] = $user['role'];
            $_SESSION['user_department_id'] = $user['departmentId'];
            $_SESSION['user_fullname'] = $user['fullName'];
            
            unset($user['password']);
            
            http_response_code(200);
            echo json_encode($user);

        } else {
            http_response_code(401);
            echo json_encode(["message" => "Invalid username or password."]);
        }
    } else {
        http_response_code(401);
        echo json_encode(["message" => "Invalid username or password."]);
    }
    $stmt->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "A server error occurred during login.", "error" => $e->getMessage()]);
}

$conn->close();
?>