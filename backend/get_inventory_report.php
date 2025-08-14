<?php
require_once 'auth_check.php';

header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
$conn = getDbConnection();

authorize('report_view', $conn);

$startDate = isset($_GET['startDate']) ? $_GET['startDate'] : date('Y-m-01');
$endDate = isset($_GET['endDate']) ? $_GET['endDate'] : date('Y-m-t');

// --- START: MODIFICATION ---
// The script now returns two main sections: 'summary' for the table and 'trend' for the new graph.

$response = [
    'summary' => [],
    'trend' => []
];

// --- Part 1: Generate the Summary Table Data (existing logic) ---
$parts_sql = "SELECT id, name, sku, price, quantity FROM parts";
$parts_result = $conn->query($parts_sql);
$report = [];
$part_prices = [];
while($part = $parts_result->fetch_assoc()) {
    $part_prices[$part['id']] = floatval($part['price']);
    $report[$part['id']] = [
        'name' => $part['name'],
        'sku' => $part['sku'],
        'price' => floatval($part['price']),
        'ending_qty' => intval($part['quantity']),
        'stock_in' => 0,
        'stock_out' => 0,
    ];
}

$logs_sql = "SELECT details, action FROM logs WHERE timestamp BETWEEN ? AND ?";
$stmt_summary = $conn->prepare($logs_sql);
$startDateFull = $startDate . ' 00:00:00';
$endDateFull = $endDate . ' 23:59:59';
$stmt_summary->bind_param("ss", $startDateFull, $endDateFull);
$stmt_summary->execute();
$logs_result = $stmt_summary->get_result();

while($log = $logs_result->fetch_assoc()) {
    preg_match('/Added (\d+) unit\(s\) to .*?\(Part ID: (\d+)\)/', $log['details'], $in_matches);
    preg_match_all('/(\d+) x PartID (\d+)/', $log['details'], $out_matches, PREG_SET_ORDER);
    
    if (($log['action'] === 'Direct Part Restock' || $log['action'] === 'Parts Restocked (Request)') && isset($in_matches[2])) {
        $partId = intval($in_matches[2]);
        if (isset($report[$partId])) $report[$partId]['stock_in'] += intval($in_matches[1]);
    } elseif (($log['action'] === 'Parts Consumed' || $log['action'] === 'Parts Issued from Storage') && !empty($out_matches)) {
        foreach($out_matches as $match) {
            $partId = intval($match[2]);
            if (isset($report[$partId])) $report[$partId]['stock_out'] += intval($match[1]);
        }
    }
}
$stmt_summary->close();

foreach($report as &$part) {
    $part['starting_qty'] = $part['ending_qty'] - $part['stock_in'] + $part['stock_out'];
    $part['total_value'] = $part['ending_qty'] * $part['price'];
}
$response['summary'] = array_values($report);


// --- Part 2: Generate the Trend Graph Data ---
$trend_data = [];
$period = new DatePeriod(new DateTime($startDate), new DateInterval('P1D'), (new DateTime($endDate))->modify('+1 day'));
foreach ($period as $date) {
    $trend_data[$date->format('Y-m-d')] = ['stock_in_value' => 0, 'stock_out_value' => 0];
}

$trend_logs_sql = "SELECT DATE(timestamp) as log_date, details, action FROM logs WHERE timestamp BETWEEN ? AND ?";
$stmt_trend = $conn->prepare($trend_logs_sql);
$stmt_trend->bind_param("ss", $startDateFull, $endDateFull);
$stmt_trend->execute();
$trend_logs_result = $stmt_trend->get_result();

while($log = $trend_logs_result->fetch_assoc()) {
    $log_date = $log['log_date'];
    if (!isset($trend_data[$log_date])) continue;

    preg_match('/Added (\d+) unit\(s\) to .*?\(Part ID: (\d+)\)/', $log['details'], $in_matches);
    preg_match_all('/(\d+) x PartID (\d+)/', $log['details'], $out_matches, PREG_SET_ORDER);

    if (($log['action'] === 'Direct Part Restock' || $log['action'] === 'Parts Restocked (Request)') && isset($in_matches[2])) {
        $partId = intval($in_matches[2]);
        $qty = intval($in_matches[1]);
        $price = $part_prices[$partId] ?? 0;
        $trend_data[$log_date]['stock_in_value'] += $qty * $price;
    } elseif (($log['action'] === 'Parts Consumed' || $log['action'] === 'Parts Issued from Storage') && !empty($out_matches)) {
        foreach($out_matches as $match) {
            $partId = intval($match[2]);
            $qty = intval($match[1]);
            $price = $part_prices[$partId] ?? 0;
            $trend_data[$log_date]['stock_out_value'] += $qty * $price;
        }
    }
}
$stmt_trend->close();
$response['trend'] = $trend_data;
// --- END: MODIFICATION ---

$conn->close();
echo json_encode($response);
?>