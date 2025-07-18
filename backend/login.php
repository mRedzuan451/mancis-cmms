<?php
// login.php (CORS and Session setup remains the same at the top)
// ...

session_start();
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { /* ... error handling ... */ }

$data = json_decode(file_get_contents("php://input"));
// ... (input validation remains the same)

$login_user = $data->username;
$login_pass = $data->password;

$stmt = $conn->prepare("SELECT id, fullName, role, departmentId, password FROM users WHERE username = ?");
$stmt->bind_param("s", $login_user);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    if (password_verify($login_pass, $user['password'])) {
        // --- THIS IS THE NEW LOGIC ---
        // 1. Get default permissions for the user's role.
        require_once 'permissions_config.php';
        $user_permissions = $role_permissions[$user['role']] ?? [];

        // 2. Get specific overrides from the database.
        $stmt_perms = $conn->prepare("SELECT permission_key, has_permission FROM user_permissions WHERE user_id = ?");
        $stmt_perms->bind_param("i", $user['id']);
        $stmt_perms->execute();
        $overrides_result = $stmt_perms->get_result();
        
        $overrides = [];
        while($row = $overrides_result->fetch_assoc()) {
            $overrides[$row['permission_key']] = (bool)$row['has_permission'];
        }
        $stmt_perms->close();

        // 3. Combine defaults and overrides to create the final permission set.
        $final_permissions = [];
        foreach ($permissions as $key => $label) {
            if (isset($overrides[$key])) {
                // If there's a specific override, use it.
                $final_permissions[$key] = $overrides[$key];
            } else {
                // Otherwise, use the role's default.
                $final_permissions[$key] = in_array($key, $user_permissions);
            }
        }
        
        // 4. Add the final permissions to the user object.
        $user['permissions'] = $final_permissions;
        // --- END OF NEW LOGIC ---
        
        // Set session variables
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['role'];

        unset($user['password']); // Don't send password to frontend
        http_response_code(200);
        echo json_encode($user);
    } else {
        http_response_code(401);
        echo json_encode(["message" => "Invalid username or password."]);
    }
} else {
    // ... (error handling)
}

$stmt->close();
$conn->close();
?>