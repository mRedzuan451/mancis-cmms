<?php
require_once 'auth_check.php';
require_once 'permissions_config.php'; // Includes the $permissions array

// Only admins and managers should be able to see the permissions list

header("Content-Type: application/json; charset=UTF-8");

// The $permissions variable comes from the included 'permissions_config.php' file
echo json_encode($permissions);
?>