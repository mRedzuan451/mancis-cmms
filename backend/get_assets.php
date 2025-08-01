<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["message" => "Database connection failed: " . $conn->connect_error]);
    exit();
}

authorize('asset_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

// --- START: MODIFICATION ---
$sql = "";
if ($user_role === 'Admin') {
    // Admin query is simple
    $sql = "SELECT * FROM assets ORDER BY name ASC";
    $stmt = $conn->prepare($sql);
} else {
    // Non-admin query is now ALSO simple and fast!
    $sql = "SELECT * FROM assets WHERE departmentId = ? ORDER BY name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_department_id);
}
// --- END: MODIFICATION ---

$stmt->execute();
$result = $stmt->get_result();

$assets_array = array();
if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['cost'] = floatval($row['cost']);
        $relatedParts = json_decode($row['relatedParts']);
        $row['relatedParts'] = is_array($relatedParts) ? $relatedParts : [];
        $assets_array[] = $row;
    }
}

$stmt->close();
$conn->close();
echo json_encode($assets_array);
?>