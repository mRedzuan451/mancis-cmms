<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('pm_schedule_view', $conn);

// --- START: MODIFICATION ---
$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$sql = "";
if ($user_role === 'Admin') {
    // Admins can see all schedules
    $sql = "SELECT * FROM pm_schedules ORDER BY id DESC";
    $stmt = $conn->prepare($sql);
} else {
    // Non-admins only see schedules for assets in their department
    $sql = "SELECT ps.* FROM pm_schedules ps
            JOIN assets a ON ps.assetId = a.id
            LEFT JOIN productionlines pl ON a.locationId = CONCAT('pl-', pl.id)
            LEFT JOIN sublines sl ON pl.subLineId = sl.id
            LEFT JOIN departments d1 ON sl.departmentId = d1.id
            LEFT JOIN boxes b ON a.locationId = CONCAT('box-', b.id)
            LEFT JOIN shelves sh ON b.shelfId = sh.id
            LEFT JOIN cabinets cab ON sh.cabinetId = cab.id
            LEFT JOIN departments d2 ON cab.departmentId = d2.id
            WHERE d1.id = ? OR d2.id = ?
            ORDER BY ps.id DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $user_department_id, $user_department_id);
}
// --- END: MODIFICATION ---

$stmt->execute();
$result = $stmt->get_result();

$schedules = [];
if ($result) {
    while($row = $result->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['assetId'] = intval($row['assetId']);
        $row['assignedTo'] = $row['assignedTo'] ? intval($row['assignedTo']) : null;
        $row['is_active'] = intval($row['is_active']);
        $row['frequency_interval'] = intval($row['frequency_interval']);
        $row['due_date_buffer'] = $row['due_date_buffer'] ? intval($row['due_date_buffer']) : null;
        
        // Decode JSON fields
        $row['checklist'] = json_decode($row['checklist'], true) ?: [];
        $row['requiredParts'] = json_decode($row['requiredParts'], true) ?: [];

        $schedules[] = $row;
    }
}

$stmt->close();
$conn->close();
echo json_encode($schedules);
?>