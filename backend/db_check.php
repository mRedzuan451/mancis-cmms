<?php
// backend/db_check.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/plain');

$servername = "localhost"; 
$username = "root"; 
$password = ""; 
$dbname = "mancis_db";

echo "--- Database Connection Check ---\n\n";

// 1. Attempt to connect
$conn = new mysqli($servername, $username, $password, $dbname);

// 2. Check connection
if ($conn->connect_error) {
    echo "CONNECTION FAILED.\n";
    echo "Error: " . $conn->connect_error . "\n";
    exit();
}

echo "Connection to database '$dbname' was SUCCESSFUL.\n\n";

// 3. Check for the 'partrequests' table and count its rows
$tableName = 'partrequests';
$sql = "SELECT COUNT(*) as total_rows FROM " . $tableName;
$result = $conn->query($sql);

if ($result) {
    $row = $result->fetch_assoc();
    echo "--- Row Count Check ---\n";
    echo "Found " . $row['total_rows'] . " rows in the '$tableName' table.\n\n";
} else {
    echo "--- Row Count Check ---\n";
    echo "FAILED to query the '$tableName' table. It might not exist.\n";
    echo "Error: " . $conn->error . "\n\n";
}

// 4. List all tables in the database to be sure we are in the right place
$tablesSql = "SHOW TABLES";
$tablesResult = $conn->query($tablesSql);

if ($tablesResult) {
    echo "--- Tables found in '$dbname' database ---\n";
    while ($tableRow = $tablesResult->fetch_array()) {
        echo "- " . $tableRow[0] . "\n";
    }
}

$conn->close();

?>