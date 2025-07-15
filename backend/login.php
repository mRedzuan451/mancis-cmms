<?php
// login.php

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


// 5. DATABASE AND LOGIN LOGIC
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
        // Set session variables
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['role'];
        $_SESSION['user_department_id'] = $user['departmentId'];
        $_SESSION['user_fullname'] = $user['fullName'];

        // Remove password from the returned object for security
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