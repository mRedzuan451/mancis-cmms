<?php
// session_test_1.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<h1>Session Test - Page 1</h1>";

// Explicitly set a writable session path
// Create a folder named 'sessions' inside your 'backend' folder first.
$save_path = __DIR__ . '/sessions';
if (!is_dir($save_path)) {
    mkdir($save_path, 0777, true);
}
session_save_path($save_path);

session_start();

$_SESSION['test_data'] = "Hello from ManCIS test " . date('Y-m-d H:i:s');
$_SESSION['status'] = "OK";

echo "<p>Session started.</p>";
echo "<p>Session ID: " . session_id() . "</p>";
echo "<p>Session save path: " . session_save_path() . "</p>";
echo "<p>Data saved to session: '" . $_SESSION['test_data'] . "'</p>";
echo "<hr>";
echo "<h2>SUCCESS!</h2>";
echo "<p>Now, please open session_test_2.php in a new browser tab.</p>";

?>