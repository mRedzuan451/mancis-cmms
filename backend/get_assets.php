<?php

require_once 'auth_check.php';

// Set headers to allow requests from any origin (CORS) and define the response type as JSON
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Database connection details
$servername = "localhost";
$username = "root"; // Default XAMPP username
$password = "";     // Default XAMPP password is empty
$dbname = "mancis_db";

// Create a new database connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check if the connection failed, and if so, stop the script
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// The SQL query to select all records from the assets table
$sql = "SELECT * FROM assets ORDER BY name ASC";
$result = $conn->query($sql);

$assets_array = array();

// Loop through the results from the database and add them to our PHP array
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        // --- KEY FIX: Convert the ID from a string to an integer ---
        $row['id'] = intval($row['id']);
        
        $assets_array[] = $row;
    }
}

// Close the database connection to free up resources
$conn->close();

// Encode the PHP array into a JSON string and send it as the response
echo json_encode($assets_array);
?>