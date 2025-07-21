<?php
/**
 * login.php
 * Handles user authentication, session creation, and permission loading.
 * Enhanced with comprehensive error handling.
 */

// --- 1. SET UP CORS AND HANDLE PREFLIGHT REQUEST ---
// This standard block ensures your frontend can securely communicate with the API.
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

// --- 2. CONFIGURE THE SESSION COOKIE ---
// Secure settings for the user's session cookie.
session_set_cookie_params([
    'lifetime' => 86400, // 24 hours
    'path' => '/',
    'secure' => false, // Set to true if using HTTPS
    'httponly' => true,
    'samesite' => 'Lax'
]);

// --- 3. START THE SESSION & SET HEADERS ---
session_start();
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

// --- 4. DATABASE CONNECTION ---
$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);

// **Error Handling: Database Connection**
// Checks if the connection to the database failed and returns a clean JSON error.
if ($conn->connect_error) {
    http_response_code(503); // Service Unavailable
    echo json_encode(["message" => "Database connection failed. Please contact an administrator."]);
    exit();
}

// --- 5. INPUT PROCESSING & VALIDATION ---
$data = json_decode(file_get_contents("php://input"));

// **Error Handling: Invalid Input**
// Verifies that the frontend sent valid JSON with a non-empty username and a password.
if (json_last_error() !== JSON_ERROR_NONE || !isset($data->username) || !isset($data->password) || empty(trim($data->username))) {
    http_response_code(400); // Bad Request
    echo json_encode(["message" => "Invalid input. Username and password are required."]);
    exit();
}

$login_user = $data->username;
$login_pass = $data->password;

// --- 6. USER AUTHENTICATION & SESSION CREATION ---
try {
    $stmt = $conn->prepare("SELECT id, fullName, role, departmentId, password FROM users WHERE username = ?");
    
    // **Error Handling: SQL Preparation**
    // Catches errors if the SQL query itself is invalid (e.g., table name typo).
    if ($stmt === false) {
        throw new Exception("Server error: Could not prepare the database statement.");
    }
    
    $stmt->bind_param("s", $login_user);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();
        
        // Verify password against the stored hash
        if (password_verify($login_pass, $user['password'])) {
            // --- SUCCESS PATH ---
            // Password is correct, get user's effective permissions.
            require_once 'permission_checker.php';
            $user['permissions'] = getEffectivePermissions($user['id'], $conn);
            
            // Store all necessary info in the session for use in other API calls.
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_role'] = $user['role'];
            $_SESSION['user_department_id'] = $user['departmentId'];
            $_SESSION['user_fullname'] = $user['fullName'];
            
            // Remove password before sending user data to the frontend.
            unset($user['password']);
            
            http_response_code(200);
            echo json_encode($user);

        } else {
            // **Error Handling: Incorrect Password**
            http_response_code(401); // Unauthorized
            echo json_encode(["message" => "Invalid username or password."]);
        }
    } else {
        // **Error Handling: User Not Found**
        // Returns the same generic message as an incorrect password.
        // This prevents attackers from guessing which usernames are valid.
        http_response_code(401); // Unauthorized
        echo json_encode(["message" => "Invalid username or password."]);
    }
    $stmt->close();

} catch (Exception $e) {
    // **Error Handling: General Server Errors**
    // A fallback to catch any other unexpected errors during execution.
    http_response_code(500); // Internal Server Error
    // In a production environment, you might log the detailed error but only show a generic message to the user.
    echo json_encode(["message" => "A server error occurred during login.", "error" => $e->getMessage()]);
}

$conn->close();
?>