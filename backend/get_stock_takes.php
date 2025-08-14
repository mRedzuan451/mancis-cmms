<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();

authorize('stock_take_create', $conn);

// --- START: MODIFICATION ---
$user_role = $_SESSION['user_role'];
$user_department_id = $_SESSION['user_department_id'];

$sql = "";
if ($user_role === 'Admin') {
    // Admins see all stock take sessions
    $sql = "SELECT st.*, u.fullName as creator_name 
            FROM stock_takes st 
            JOIN users u ON st.creator_id = u.id 
            ORDER BY st.creation_date DESC";
    $stmt = $conn->prepare($sql);
} else {
    // Non-admins only see sessions created by users in their own department
    $sql = "SELECT st.*, u.fullName as creator_name 
            FROM stock_takes st 
            JOIN users u ON st.creator_id = u.id 
            WHERE u.departmentId = ?
            ORDER BY st.creation_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_department_id);
}
// --- END: MODIFICATION ---

$stmt->execute();
$result = $stmt->get_result();

$output = [];
while($row = $result->fetch_assoc()) {
    $output[] = $row;
}

$stmt->close();
$conn->close();
echo json_encode($output);
?>