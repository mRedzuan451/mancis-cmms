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

$sql = "";
if ($user_role === 'Admin') {
    $sql = "SELECT * FROM assets ORDER BY name ASC";
    $stmt = $conn->prepare($sql);
} else {
    // This query finds all assets located in the user's department,
    // checking both production line locations and storage locations.
    $sql = "SELECT a.* FROM assets a
            LEFT JOIN productionlines pl ON a.locationId = CONCAT('pl-', pl.id)
            LEFT JOIN sublines sl ON pl.subLineId = sl.id
            LEFT JOIN departments d1 ON sl.departmentId = d1.id
            LEFT JOIN boxes b ON a.locationId = CONCAT('box-', b.id)
            LEFT JOIN shelves sh ON b.shelfId = sh.id
            LEFT JOIN cabinets cab ON sh.cabinetId = cab.id
            LEFT JOIN departments d2 ON cab.departmentId = d2.id
            WHERE d1.id = ? OR d2.id = ?
            ORDER BY a.name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $user_department_id, $user_department_id);
}

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