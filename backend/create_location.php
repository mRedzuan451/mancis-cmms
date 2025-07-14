<?php
require_once 'auth_check.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

if (empty($data->type) || empty($data->name)) {
    http_response_code(400);
    echo json_encode(["message" => "Location type and name are required."]);
    exit();
}

$type = $data->type;
$name = $data->name;
$parentId = isset($data->parentId) ? $data->parentId : null;

$sql = "";
$params = [];
$param_types = "";

// Use a switch to determine the correct table and columns
switch ($type) {
    case 'division':
        $sql = "INSERT INTO divisions (name) VALUES (?)";
        $param_types = "s";
        $params[] = $name;
        break;
    case 'department':
        $sql = "INSERT INTO departments (name, divisionId) VALUES (?, ?)";
        $param_types = "si";
        $params = [$name, $parentId];
        break;
    case 'subLine':
        $sql = "INSERT INTO sublines (name, departmentId) VALUES (?, ?)";
        $param_types = "si";
        $params = [$name, $parentId];
        break;
    case 'productionLine':
        $sql = "INSERT INTO productionlines (name, subLineId) VALUES (?, ?)";
        $param_types = "si";
        $params = [$name, $parentId];
        break;
    case 'cabinet':
        $sql = "INSERT INTO cabinets (name, departmentId) VALUES (?, ?)";
        $param_types = "si";
        $params = [$name, $parentId];
        break;
    case 'shelf':
        $sql = "INSERT INTO shelves (name, cabinetId) VALUES (?, ?)";
        $param_types = "si";
        $params = [$name, $parentId];
        break;
    case 'box':
        $sql = "INSERT INTO boxes (name, shelfId) VALUES (?, ?)";
        $param_types = "si";
        $params = [$name, $parentId];
        break;
    default:
        http_response_code(400);
        echo json_encode(["message" => "Invalid location type specified."]);
        exit();
}

$stmt = $conn->prepare($sql);
// Use call_user_func_array to bind a variable number of parameters
$stmt->bind_param($param_types, ...$params);

if ($stmt->execute()) {
    http_response_code(201);
    echo json_encode(["message" => ucfirst($type) . " created successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to create " . $type, "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>