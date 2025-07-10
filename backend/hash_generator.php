<?php
// --- Password Hash Generator ---

// 1. Enter the password you want to use for your user account.
$plainPassword = 'password';

// 2. This will create a secure hash of that password.
$hashedPassword = password_hash($plainPassword, PASSWORD_DEFAULT);

// 3. The script will display the hash. Copy this entire string.
echo "Password: " . htmlspecialchars($plainPassword) . "<br>";
echo "Hashed Value: " . htmlspecialchars($hashedPassword);

?>