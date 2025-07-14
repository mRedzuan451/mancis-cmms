<?php
// session_test_2.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<h1>Session Test - Page 2</h1>";

// We must point to the SAME session path as the first file.
$save_path = __DIR__ . '/sessions';
session_save_path($save_path);

session_start();

echo "<p>Session started.</p>";
echo "<p>Session ID: " . session_id() . "</p>";
echo "<p>Session save path: " . session_save_path() . "</p>";
echo "<hr>";

if (isset($_SESSION['test_data']) && !empty($_SESSION['test_data'])) {
    echo "<h2><font color='green'>SUCCESS!</font></h2>";
    echo "<p>Session data was found successfully.</p>";
    echo "<p>Retrieved data: '" . $_SESSION['test_data'] . "'</p>";
} else {
    echo "<h2><font color='red'>FAILURE!</font></h2>";
    echo "<p>Could NOT find the data from the first page.</p>";
    echo "<p>This confirms that your PHP server environment is failing to persist sessions correctly.</p>";
}

?>