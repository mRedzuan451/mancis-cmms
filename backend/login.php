<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

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

// Get the posted data
$data = json_decode(file_get_contents("php://input"));

if (!isset($data->username) || !isset($data->password)) {
    http_response_code(400);
    echo json_encode(["message" => "Username and password are required."]);
    exit();
}

$login_user = $data->username;
$login_pass = $data->password;

// 1. Prepare to select the user by USERNAME ONLY
$stmt = $conn->prepare("SELECT id, fullName, employeeId, username, role, divisionId, departmentId, password FROM users WHERE username = ?");
$stmt->bind_param("s", $login_user);

$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    $hashed_password = $user['password'];

    // 2. Verify the submitted password against the hashed password from the database
    if (password_verify($login_pass, $hashed_password)) {
        // Passwords match. Successful login.
        
        // Remove the password from the user object before sending it to the frontend
        unset($user['password']);

        http_response_code(200);
        echo json_encode($user);
    } else {
        // Passwords do not match.
        http_response_code(401); // Unauthorized
        echo json_encode(["message" => "Invalid username or password."]);
    }
} else {
    // No user found with that username.
    http_response_code(401); // Unauthorized
    echo json_encode(["message" => "Invalid username or password."]);
}

$stmt->close();
$conn->close();
?>