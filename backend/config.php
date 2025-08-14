<?php
// backend/config.php

// This file contains the configuration for the application.
// It is recommended to keep this file outside of the web root directory for security.
// For the purpose of this example, it is included here.

// --- Database Configuration ---
// Replace with your actual database credentials.
define('DB_SERVER', 'localhost');
define('DB_USERNAME', 'root');
define('DB_PASSWORD', '');
define('DB_NAME', 'mancis_db');


// --- CORS Configuration ---
// A whitelist of allowed origins for Cross-Origin Resource Sharing.
// Add the domains from which you will be accessing the API.
$allowed_origins = [
    'http://localhost',
    'http://127.0.0.1',
    'http://192.168.141.42'
];

?>
