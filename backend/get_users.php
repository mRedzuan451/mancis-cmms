<?php

require_once 'auth_check.php';

// Turn on error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; 
$username = "root"; 
$password = ""; 
$dbname = "mancis_db";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// **DEBUGGING STEP 1: Check connection**
if ($conn->connect_error) {
    // If you see this, the connection details are wrong.
    http_response_code(500);
    echo json_encode([
        "message" => "Connection Failed",
        "error" => $conn->connect_error
    ]);
    exit(); // Stop the script
}

// Select all fields EXCEPT the password for security
$sql = "SELECT id, fullName, employeeId, username, role, divisionId, departmentId FROM users ORDER BY fullName ASC";
$result = $conn->query($sql);

// **DEBUGGING STEP 2: Check for query errors**
if (!$result) {
    // If you see this, the SQL query itself is wrong (e.g., table name typo).
    http_response_code(500);
    echo json_encode([
        "message" => "SQL Query Failed",
        "error" => $conn->error,
        "query" => $sql
    ]);
    exit();
}

// **DEBUGGING STEP 3: Check the number of rows found**
if ($result->num_rows === 0) {
    // If you see this, the query worked but found no data.
    // This is the most likely current problem. It means you are connected to the wrong database
    // or the 'users' table in this 'mancis_db' is actually empty.
    http_response_code(200); // It's not an error, just empty
    echo json_encode([
        "message" => "Query successful, but no users were found in the database.",
        "query" => $sql,
        "rows_found" => $result->num_rows
    ]);
    exit();
}

// If the script reaches here, it means data was found.
$output_array = array();
while($row = $result->fetch_assoc()) {
    $row['id'] = intval($row['id']);
    $row['divisionId'] = intval($row['divisionId']);
    $row['departmentId'] = intval($row['departmentId']);
    $output_array[] = $row;
}

$conn->close();
echo json_encode($output_array);
?>