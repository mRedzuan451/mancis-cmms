<?php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    // Return a server error if connection fails
    http_response_code(500);
    echo json_encode(["message" => "Connection failed: " . $conn->connect_error]);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

if (
    empty($data->fullName) || empty($data->employeeId) || empty($data->username) || 
    empty($data->password) || empty($data->role) || !isset($data->divisionId) || !isset($data->departmentId)
) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. All fields are required."]);
    exit();
}

$stmt_check = $conn->prepare("SELECT id FROM users WHERE username = ?");
$stmt_check->bind_param("s", $data->username);
$stmt_check->execute();
$result = $stmt_check->get_result();
if ($result->num_rows > 0) {
    http_response_code(409); // Conflict
    echo json_encode(["message" => "Username already exists. Please choose another."]);
    $stmt_check->close();
    $conn->close();
    exit();
}
$stmt_check->close();

$hashedPassword = password_hash($data->password, PASSWORD_DEFAULT);

// Insert new user with the HASHED password
$stmt = $conn->prepare("INSERT INTO users (fullName, employeeId, username, password, role, divisionId, departmentId, email, contact_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("sssssiiss", 
    $data->fullName, 
    $data->employeeId, 
    $data->username, 
    $hashedPassword, // Use the new $hashedPassword variable here
    $data->role,
    $data->divisionId,
    $data->departmentId,
    $data->email,
    $data->contact_number
);

if ($stmt->execute()) {
    http_response_code(201); // Created
    echo json_encode(["message" => "User registered successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to register user."]);
}

$stmt->close();
$conn->close();
?>