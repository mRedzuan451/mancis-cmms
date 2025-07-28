<?php
require_once 'auth_check.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('report_cost_view', $conn);

$startDate = $_GET['startDate'] ?? date('Y-m-01');
$endDate = $_GET['endDate'] ?? date('Y-m-t');

// Step 1: Get all part prices into a lookup array for efficiency
$parts_sql = "SELECT id, price FROM parts";
$parts_result = $conn->query($parts_sql);
$part_prices = [];
while ($part = $parts_result->fetch_assoc()) {
    $part_prices[$part['id']] = floatval($part['price']);
}

// Step 2: Get all completed work orders within the date range
$wo_sql = "SELECT assetId, requiredParts FROM workorders WHERE status = 'Completed' AND completedDate BETWEEN ? AND ?";
$stmt = $conn->prepare($wo_sql);
$stmt->bind_param("ss", $startDate, $endDate);
$stmt->execute();
$completed_wos = $stmt->get_result();

$asset_costs = [];

// Step 3: Process each work order in PHP to calculate costs
while ($wo = $completed_wos->fetch_assoc()) {
    if (empty($wo['requiredParts'])) continue;

    $required_parts = json_decode($wo['requiredParts'], true);
    if (!is_array($required_parts) || empty($required_parts)) continue;

    $assetId = $wo['assetId'];
    if (!isset($asset_costs[$assetId])) {
        $asset_costs[$assetId] = 0;
    }

    foreach ($required_parts as $part_item) {
        $partId = $part_item['partId'];
        $quantity = intval($part_item['quantity']);
        $price = $part_prices[$partId] ?? 0; // Use 0 if price isn't found
        $asset_costs[$assetId] += $quantity * $price;
    }
}
$stmt->close();

// Step 4: Format the final report data with asset and department names
$report_data = [];
if (!empty($asset_costs)) {
    // Get all asset and department info in one query
    $asset_info_sql = "SELECT a.id, a.name, d.name as department_name FROM assets a
                       LEFT JOIN productionlines pl ON a.locationId = CONCAT('pl-', pl.id)
                       LEFT JOIN sublines sl ON pl.subLineId = sl.id
                       LEFT JOIN departments d ON sl.departmentId = d.id";
    $asset_info_result = $conn->query($asset_info_sql);
    $asset_details = [];
    while ($row = $asset_info_result->fetch_assoc()) {
        $asset_details[$row['id']] = [
            'name' => $row['name'],
            'department' => $row['department_name'] ?? 'N/A'
        ];
    }

    foreach ($asset_costs as $assetId => $totalCost) {
        if ($totalCost > 0) {
            $report_data[] = [
                'assetId' => $assetId,
                'assetName' => $asset_details[$assetId]['name'] ?? 'Unknown Asset',
                'departmentName' => $asset_details[$assetId]['department'] ?? 'N/A',
                'totalCost' => $totalCost
            ];
        }
    }
}

header("Content-Type: application/json; charset=UTF-8");
echo json_encode($report_data);
$conn->close();
?>