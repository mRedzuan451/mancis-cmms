<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// The authorize() call has been updated to the new permission system.
authorize('report_view', $conn);

$startDate = isset($_GET['startDate']) ? $_GET['startDate'] . ' 00:00:00' : date('Y-m-d') . ' 00:00:00';
$endDate = isset($_GET['endDate']) ? $_GET['endDate'] . ' 23:59:59' : date('Y-m-d') . ' 23:59:59';

$report = [];

// 1. Get all parts as the base
$parts_sql = "SELECT id, name, sku, price, quantity FROM parts";
$parts_result = $conn->query($parts_sql);
while($part = $parts_result->fetch_assoc()) {
    $report[$part['id']] = [
        'name' => $part['name'],
        'sku' => $part['sku'],
        'price' => floatval($part['price']),
        'ending_qty' => intval($part['quantity']),
        'stock_in' => 0,
        'stock_out' => 0,
    ];
}

// 2. Calculate stock movements from logs within the date range
$logs_sql = "SELECT details, action FROM logs WHERE timestamp BETWEEN ? AND ?";
$stmt = $conn->prepare($logs_sql);
$stmt->bind_param("ss", $startDate, $endDate);
$stmt->execute();
$logs_result = $stmt->get_result();

while($log = $logs_result->fetch_assoc()) {
    $details = $log['details'];
    $action = $log['action'];

    // Regex to find 'Part ID: xxx' and quantities
    preg_match('/Added (\d+) unit\(s\) to .*?\(Part ID: (\d+)\)/', $details, $in_matches);
    preg_match_all('/(\d+) x PartID (\d+)/', $details, $out_matches, PREG_SET_ORDER);
    
    if (($action === 'Direct Part Restock' || $action === 'Parts Restocked (Request)') && isset($in_matches[2])) {
        $partId = intval($in_matches[2]);
        $qty = intval($in_matches[1]);
        if (isset($report[$partId])) {
            $report[$partId]['stock_in'] += $qty;
        }
    } elseif (($action === 'Parts Consumed' || $action === 'Parts Issued from Storage') && !empty($out_matches)) {
        foreach($out_matches as $match) {
            $partId = intval($match[2]);
            $qty = intval($match[1]);
            if (isset($report[$partId])) {
                $report[$partId]['stock_out'] += $qty;
            }
        }
    }
}
$stmt->close();

// 3. Calculate starting quantity and total value for each part
foreach($report as &$part) {
    $part['starting_qty'] = $part['ending_qty'] - $part['stock_in'] + $part['stock_out'];
    $part['total_value'] = $part['ending_qty'] * $part['price'];
}

$conn->close();
// Return as a simple array for easier iteration on the frontend
echo json_encode(array_values($report));
?>