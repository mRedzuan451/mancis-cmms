<?php
require_once 'auth_check.php';
$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }
authorize('stock_take_create', $conn);

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

// --- START: MODIFICATION ---
// 1. Get the Department Name for the Stock Take session.
$departmentName = 'N/A';
$stmt_dept = $conn->prepare(
    "SELECT d.name as deptName 
     FROM stock_takes st
     JOIN users u ON st.creator_id = u.id
     JOIN departments d ON u.departmentId = d.id
     WHERE st.id = ?"
);
$stmt_dept->bind_param("i", $id);
$stmt_dept->execute();
$dept_result = $stmt_dept->get_result()->fetch_assoc();
if ($dept_result) {
    $departmentName = $dept_result['deptName'];
}
$stmt_dept->close();
// --- END: MODIFICATION ---

$sql = "SELECT 
            p.name, 
            p.sku, 
            sti.system_qty, 
            sti.counted_qty,
            CONCAT_WS(' > ', d.name, dep.name, cab.name, sh.name, b.name) AS fullLocationName
        FROM 
            stock_take_items sti
        JOIN 
            parts p ON sti.part_id = p.id
        LEFT JOIN 
            boxes b ON p.locationId = CONCAT('box-', b.id)
        LEFT JOIN 
            shelves sh ON b.shelfId = sh.id
        LEFT JOIN 
            cabinets cab ON sh.cabinetId = cab.id
        LEFT JOIN 
            departments dep ON cab.departmentId = dep.id
        LEFT JOIN 
            divisions d ON dep.divisionId = d.id
        WHERE 
            sti.stock_take_id = ? 
        ORDER BY 
            p.name ASC";
        
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();

// --- START: MODIFICATION ---
// 2. Add the Department Name to the HTML header.
$html = "<h1>Stock Take Counting Sheet (ID: $id)</h1>";
$html .= "<p><strong>Department:</strong> " . htmlspecialchars($departmentName) . "</p>";
$html .= "<p><strong>Date Printed:</strong> " . date('Y-m-d H:i') . "</p>";
// --- END: MODIFICATION ---

$html .= "<table border='1' style='width:100%; border-collapse: collapse;'><thead><tr>
    <th style='padding: 5px; text-align: left;'>Part Name</th>
    <th style='padding: 5px; text-align: left;'>SKU</th>
    <th style='padding: 5px; text-align: left;'>Location</th>
    <th style='padding: 5px; text-align: right;'>System Qty</th>
    <th style='padding: 5px; text-align: right;'>Physical Qty</th>
    <th style='padding: 5px; text-align: right;'>Variance</th>
    </tr></thead><tbody>";

while ($row = $result->fetch_assoc()) {
    $locationName = $row['fullLocationName'] ?? 'N/A';
    
    $counted_qty = $row['counted_qty'] ?? 0;
    $variance = $counted_qty - $row['system_qty'];
    $variance_color = $variance < 0 ? 'color: red;' : ($variance > 0 ? 'color: green;' : '');

    $html .= "<tr>
        <td style='padding: 5px;'>{$row['name']}</td>
        <td style='padding: 5px;'>{$row['sku']}</td>
        <td style='padding: 5px;'>{$locationName}</td>
        <td style='padding: 5px; text-align: right;'>{$row['system_qty']}</td>
        <td style='padding: 5px; text-align: right; height: 30px;'>{$counted_qty}</td>
        <td style='padding: 5px; text-align: right; font-weight: bold; {$variance_color}'>{$variance}</td>
    </tr>";
}
$html .= "</tbody></table>";
$html .= "<div style='margin-top: 50px; display: flex; justify-content: space-around; text-align: center;'>
    <div style='width: 30%;'><p>_________________________</p><p><strong>Prepared By</strong></p></div>
    <div style='width: 30%;'><p>_________________________</p><p><strong>Confirmed By</strong></p></div>
    <div style='width: 30%;'><p>_________________________</p><p><strong>Acknowledged By</strong></p></div>
</div>";

echo $html;
?>