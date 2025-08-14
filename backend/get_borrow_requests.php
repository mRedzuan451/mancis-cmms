<?php
require_once 'auth_check.php';
require_once 'permission_checker.php'; // Include the permission functions

require_once 'database.php';
$conn = getDbConnection();

// Check if the user has permission to either request or approve borrows.
if (!has_permission('part_borrow_request', $conn) && !has_permission('part_borrow_approve', $conn)) {
     http_response_code(403);
     echo json_encode(["message" => "You do not have permission to view this page."]);
     exit();
}

$user_id = $_SESSION['user_id'];
$department_id = $_SESSION['user_department_id'];
$can_approve = has_permission('part_borrow_approve', $conn);

$sql = "SELECT 
            pb.*,
            p.name as partName,
            p.sku as partSku,
            borrow_dept.name as borrowingDeptName,
            lend_dept.name as lendingDeptName,
            req.fullName as requesterName
        FROM part_borrows pb
        JOIN parts p ON pb.partId = p.id
        JOIN departments borrow_dept ON pb.borrowingDeptId = borrow_dept.id
        JOIN departments lend_dept ON pb.lendingDeptId = lend_dept.id
        JOIN users req ON pb.requesterId = req.id
        WHERE ";

if ($can_approve) {
    // Managers/Supervisors see requests TO their department OR made BY them
    $sql .= "(pb.lendingDeptId = ? OR pb.requesterId = ?)";
    $stmt = $conn->prepare($sql . " ORDER BY pb.requestDate DESC");
    $stmt->bind_param("ii", $department_id, $user_id);
} else {
    // Technicians/Clerks only see requests made BY them
    $sql .= "pb.requesterId = ?";
    $stmt = $conn->prepare($sql . " ORDER BY pb.requestDate DESC");
    $stmt->bind_param("i", $user_id);
}

$stmt->execute();
$result = $stmt->get_result();
$requests = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode($requests);
$stmt->close();
$conn->close();
?>