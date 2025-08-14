<?php
// backend/database.php

require_once 'config.php';

/**
 * Establishes a connection to the database and returns the connection object.
 *
 * This function uses the constants defined in config.php to connect to the database.
 * It also includes basic error handling for the connection.
 *
 * @return mysqli The database connection object.
 */
function getDbConnection() {
    // Create a new database connection
    $conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_NAME);

    // Check for connection errors
    if ($conn->connect_error) {
        // If there is a connection error, stop the script and return a JSON error message.
        // This is crucial for the frontend to understand what went wrong.
        http_response_code(500); // Internal Server Error
        echo json_encode([
            "message" => "Database connection failed.",
            "error" => $conn->connect_error
        ]);
        exit();
    }

    return $conn;
}
?>
