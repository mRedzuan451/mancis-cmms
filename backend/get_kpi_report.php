<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('report_kpi_view', $conn);

$startDate = $_GET['startDate'] ?? date('Y-m-01');
$endDate = $_GET['endDate'] ?? date('Y-m-t');

$response = [
    'overall_mttr_hours' => 0,
    'overall_mtbf_days' => 0,
    'asset_kpis' => []
];

// --- MTTR Calculation ---
$mttr_sql = "SELECT assetId, breakdownTimestamp, completedDate 
             FROM workorders 
             WHERE wo_type = 'CM' AND status = 'Completed' AND breakdownTimestamp IS NOT NULL AND completedDate BETWEEN ? AND ?";
$stmt_mttr = $conn->prepare($mttr_sql);
$stmt_mttr->bind_param("ss", $startDate, $endDate);
$stmt_mttr->execute();
$mttr_result = $stmt_mttr->get_result();

$total_repair_seconds = 0;
$repair_count = 0;
$asset_repair_times = [];

while ($row = $mttr_result->fetch_assoc()) {
    $repair_time = strtotime($row['completedDate']) - strtotime($row['breakdownTimestamp']);
    if ($repair_time > 0) {
        $total_repair_seconds += $repair_time;
        $repair_count++;
        if (!isset($asset_repair_times[$row['assetId']])) {
            $asset_repair_times[$row['assetId']] = ['total_seconds' => 0, 'count' => 0];
        }
        $asset_repair_times[$row['assetId']]['total_seconds'] += $repair_time;
        $asset_repair_times[$row['assetId']]['count']++;
    }
}
$stmt_mttr->close();
if ($repair_count > 0) {
    $response['overall_mttr_hours'] = round(($total_repair_seconds / $repair_count) / 3600, 2);
}

// --- MTBF Calculation ---
$mtbf_sql = "SELECT id, name FROM assets";
$assets_result = $conn->query($mtbf_sql);
$all_assets = $assets_result->fetch_all(MYSQLI_ASSOC);

$total_uptime_seconds = 0;
$total_failures = 0;

foreach ($all_assets as $asset) {
    $assetId = $asset['id'];
    $stmt_failures = $conn->prepare("SELECT breakdownTimestamp FROM workorders WHERE assetId = ? AND wo_type = 'CM' AND breakdownTimestamp IS NOT NULL ORDER BY breakdownTimestamp ASC");
    $stmt_failures->bind_param("i", $assetId);
    $stmt_failures->execute();
    $failures_result = $stmt_failures->get_result();
    
    $failure_timestamps = [];
    while ($row = $failures_result->fetch_assoc()) {
        $failure_timestamps[] = strtotime($row['breakdownTimestamp']);
    }
    $stmt_failures->close();

    $asset_uptime = 0;
    $asset_failure_count = count($failure_timestamps) > 1 ? count($failure_timestamps) - 1 : 0;

    if ($asset_failure_count > 0) {
        for ($i = 0; $i < $asset_failure_count; $i++) {
            $uptime = $failure_timestamps[$i + 1] - $failure_timestamps[$i];
            $asset_uptime += $uptime;
        }
        $total_uptime_seconds += $asset_uptime;
        $total_failures += $asset_failure_count;
    }
    
    // Per-asset KPI calculation
    $asset_mttr = 0;
    if (isset($asset_repair_times[$assetId]) && $asset_repair_times[$assetId]['count'] > 0) {
        $asset_mttr = round(($asset_repair_times[$assetId]['total_seconds'] / $asset_repair_times[$assetId]['count']) / 3600, 2);
    }
    $asset_mtbf = 0;
    if ($asset_failure_count > 0) {
        $asset_mtbf = round(($asset_uptime / $asset_failure_count) / 86400, 2);
    }

    if ($asset_mttr > 0 || $asset_mtbf > 0) {
        $response['asset_kpis'][] = [
            'assetId' => $assetId,
            'assetName' => $asset['name'],
            'mttr_hours' => $asset_mttr,
            'mtbf_days' => $asset_mtbf
        ];
    }
}
if ($total_failures > 0) {
    $response['overall_mtbf_days'] = round(($total_uptime_seconds / $total_failures) / 86400, 2);
}

header("Content-Type: application/json; charset=UTF-8");
echo json_encode($response);
$conn->close();
?>