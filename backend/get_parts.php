<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

// --- START: MODIFICATION ---
$sql = "";
if ($user_role === 'Admin') {
    // Admin query joins to get department name for display, but doesn't need it for filtering
    $sql = "SELECT p.*, d.name as departmentName 
            FROM parts p
            LEFT JOIN departments d ON p.departmentId = d.id
            ORDER BY p.name ASC";
    $stmt = $conn->prepare($sql);
} else {
    // Non-admin query is now simple and fast!
    $sql = "SELECT p.* FROM parts p
            WHERE p.departmentId = ?
            ORDER BY p.name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_department_id);
}
// --- END: MODIFICATION ---

$stmt->execute();
$result = $stmt->get_result();

$output_array = array();
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['quantity'] = intval($row['quantity']);
        $row['minQuantity'] = intval($row['minQuantity']);
        $row['price'] = floatval($row['price']);
        $row['relatedAssets'] = json_decode($row['relatedAssets']);
        if (!is_array($row['relatedAssets'])) {
            $row['relatedAssets'] = [];
        }
        $output_array[] = $row;
    }
}
$stmt->close();
$conn->close();
echo json_encode($output_array);
?>