<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('part_view', $conn);

$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$sql = "";
if ($user_role === 'Admin') {
    $sql = "SELECT * FROM parts ORDER BY name ASC";
    $stmt = $conn->prepare($sql);
} else {
    $sql = "SELECT p.* FROM parts p
            JOIN boxes b ON p.locationId = CONCAT('box-', b.id)
            JOIN shelves sh ON b.shelfId = sh.id
            JOIN cabinets cab ON sh.cabinetId = cab.id
            WHERE cab.departmentId = ?
            ORDER BY p.name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_department_id);
}

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