<?php
require_once 'auth_check.php';
$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }
authorize('stock_take_create', $conn);

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

$sql = "SELECT p.name, p.sku, p.locationId, sti.system_qty FROM stock_take_items sti JOIN parts p ON sti.part_id = p.id WHERE sti.stock_take_id = ? ORDER BY p.name ASC";
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
    </tr></thead><tbody>";

while ($row = $result->fetch_assoc()) {
    $locationName = $row['locationId']; // In a real scenario, you'd convert this to full name
    $html .= "<tr>
        <td style='padding: 5px;'>{$row['name']}</td>
        <td style='padding: 5px;'>{$row['sku']}</td>
        <td style='padding: 5px;'>{$locationName}</td>
        <td style='padding: 5px; text-align: right;'>{$row['system_qty']}</td>
        <td style='padding: 5px; height: 30px;'></td>
    </tr>";
}
$html .= "</tbody></table>";
$html .= "<div style='margin-top: 50px; display: flex; justify-content: space-around; text-align: center;'>
    <div style='width: 30%;'><p>_________________________</p><p><strong>Prepared By</strong></p></div>
    <div style='width: 30%;'><p>_________________________</p><p><strong>Confirmed By</strong></p></div>
    <div style='width: 30%;'><p>_________________________</p><p><strong>Acknowledged By</strong></p></div>
</div>";

echo $html; // This sends raw HTML to be printed
?>