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

// Database connection
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "mancis_db";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["message" => "Connection failed: " . $conn->connect_error]);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->username) || !isset($data->password)) {
    http_response_code(400);
    echo json_encode(["message" => "Username and password are required."]);
    exit();
}

$login_user = $data->username;
$login_pass = $data->password;

$stmt = $conn->prepare("SELECT id, fullName, employeeId, username, role, divisionId, departmentId, password FROM users WHERE username = ?");
$stmt->bind_param("s", $login_user);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    $hashed_password = $user['password'];

    if (password_verify($login_pass, $hashed_password)) {
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
$conn->close();
?>