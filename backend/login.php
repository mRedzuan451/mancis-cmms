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
    die("Connection failed: " . $conn->connect_error);
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

// Use a prepared statement to prevent SQL injection
$stmt = $conn->prepare("SELECT id, fullName, employeeId, username, role, divisionId, departmentId FROM users WHERE username = ? AND password = ?");
$stmt->bind_param("ss", $login_user, $login_pass);

$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    http_response_code(200);
    echo json_encode($user);
} else {
    http_response_code(401); // Unauthorized
    echo json_encode(["message" => "Invalid username or password."]);
}

$stmt->close();
$conn->close();
?>