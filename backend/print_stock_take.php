<?php
require_once 'auth_check.php';
$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }
authorize('stock_take_create', $conn);

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

// --- START: FIX ---
// 1. Updated the SQL query to select the 'counted_qty' as well.
$sql = "SELECT p.name, p.sku, p.locationId, sti.system_qty, sti.counted_qty 
        FROM stock_take_items sti 
        JOIN parts p ON sti.part_id = p.id 
        WHERE sti.stock_take_id = ? 
        ORDER BY p.name ASC";
// --- END: FIX ---
        
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();

$html = "<h1>Stock Take Counting Sheet (ID: $id)</h1>";
$html .= "<p>Date Printed: " . date('Y-m-d H:i') . "</p>";
$html .= "<table border='1' style='width:100%; border-collapse: collapse;'><thead><tr>
    <th style='padding: 5px; text-align: left;'>Part Name</th>
    <th style='padding: 5px; text-align: left;'>SKU</th>
    <th style='padding: 5px; text-align: left;'>Location</th>
    <th style='padding: 5px; text-align: right;'>System Qty</th>
    <th style='padding: 5px; text-align: right;'>Physical Qty</th>
    <th style='padding: 5px; text-align: right;'>Variance</th>
    </tr></thead><tbody>";

while ($row = $result->fetch_assoc()) {
    $locationName = getFullLocationName($row['locationId']); // Use the helper function for a full name
    
    // --- START: FIX ---
    // 2. Calculate variance and set colors.
    $counted_qty = $row['counted_qty'] ?? 0; // Default to 0 if not counted
    $variance = $counted_qty - $row['system_qty'];
    $variance_color = $variance < 0 ? 'color: red;' : ($variance > 0 ? 'color: green;' : '');
    // --- END: FIX ---

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