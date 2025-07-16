<?php
// backend/wo_data_check.php

// Force all errors to be visible
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/plain'); // Set to plain text for easy reading

$servername = "localhost"; 
$username = "root"; 
$password = ""; 
$dbname = "mancis_db";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    echo "Connection Failed: " . $conn->connect_error;
    exit();
}

// Get the work order ID from the URL (e.g., ?id=12)
$wo_id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($wo_id <= 0) {
    echo "ERROR: Please provide a valid Work Order ID in the URL (e.g., wo_data_check.php?id=12)";
    exit();
}

echo "--- Checking 'requiredParts' data for Work Order ID: " . $wo_id . " ---\n\n";

$stmt = $conn->prepare("SELECT requiredParts FROM workorders WHERE id = ?");
$stmt->bind_param("i", $wo_id);
$stmt->execute();
$result = $stmt->get_result();
$workorder = $result->fetch_assoc();

if ($workorder) {
    echo "RAW DATA FROM DATABASE:\n";
    echo "--------------------------\n";
    echo $workorder['requiredParts'];
    echo "\n--------------------------\n\n";

    echo "PHP's INTERPRETATION OF THE DATA:\n";
    echo "---------------------------------\n";
    $decoded_data = json_decode($workorder['requiredParts'], true);
    print_r($decoded_data);
    echo "\n---------------------------------\n";

} else {
    echo "Could not find a work order with ID: " . $wo_id;
}

$stmt->close();
$conn->close();
?>