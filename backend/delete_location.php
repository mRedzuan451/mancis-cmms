<?php

require_once 'auth_check.php';

authorize(['Admin', 'Supervisor', 'Manager']);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$data = json_decode(file_get_contents("php://input"));

if (empty($data->type) || empty($data->id)) {
    http_response_code(400);
    echo json_encode(["message" => "Location type and ID are required."]);
    exit();
}

$type = $data->type;
$id = intval($data->id);

$tableMap = [
    'division' => 'divisions',
    'department' => 'departments',
    'subLine' => 'sublines',
    'productionLine' => 'productionlines',
    'cabinet' => 'cabinets',
    'shelf' => 'shelves',
    'box' => 'boxes'
];

if (!array_key_exists($type, $tableMap)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid location type."]);
    exit();
}

$tableName = $tableMap[$type];
$sql = "DELETE FROM " . $tableName . " WHERE id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        http_response_code(200);
        echo json_encode(["message" => ucfirst($type) . " deleted successfully."]);
    } else {
        http_response_code(404);
        echo json_encode(["message" => ucfirst($type) . " not found."]);
    }
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to delete " . $type, "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>