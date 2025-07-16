<?php
// backend/update_work_order.php (Enhanced Debugging Version)
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor', 'Engineer', 'Technician']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// --- This array will hold our debug log ---
$debug = [];

try {
    $debug['script_start'] = 'OK';
    $data = json_decode(file_get_contents("php://input"));
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    
    $debug['received_wo_id'] = $id;
    $debug['received_data'] = $data;

    if (isset($data->status) && $data->status === 'Completed') {
        $debug['consumption_logic'] = 'START - Status is Completed.';
        
        $stmt_get = $conn->prepare("SELECT requiredParts FROM workorders WHERE id = ?");
        $stmt_get->bind_param("i", $id);
        $stmt_get->execute();
        $wo_result = $stmt_get->get_result()->fetch_assoc();
        $stmt_get->close();
        
        $requiredParts = isset($wo_result['requiredParts']) ? json_decode($wo_result['requiredParts'], true) : [];
        $debug['found_required_parts'] = $requiredParts;

        if (!empty($requiredParts)) {
            $debug['parts_to_deduct'] = [];
            foreach ($requiredParts as $part) {
                if (!isset($part['partId']) || !isset($part['quantity'])) {
                    $debug['parts_to_deduct'][] = ['status' => 'SKIPPED - Malformed entry', 'data' => $part];
                    continue; 
                }
                $partId = intval($part['partId']);
                $qty_to_deduct = intval($part['quantity']);
                $debug['parts_to_deduct'][] = ['status' => 'OK', 'partId' => $partId, 'quantity' => $qty_to_deduct];
            }
        } else {
             $debug['consumption_logic'] = 'SKIPPED - No required parts found.';
        }
    } else {
        $debug['consumption_logic'] = 'SKIPPED - Status is not Completed.';
    }

    $debug['main_update_logic'] = 'PREPARING to build final update query.';
    $debug['data_to_be_used'] = $data;
    $debug['final_decision'] = 'SUCCESS - All checks passed. Would normally commit to database now.';

} catch (Exception $e) {
    $debug['EXCEPTION_CAUGHT'] = $e->getMessage();
}

$conn->close();
// Return the entire debug log as the response.
echo json_encode($debug);
?>