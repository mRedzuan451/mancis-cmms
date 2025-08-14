<?php
require_once 'auth_check.php';

require_once 'database.php';
$conn = getDbConnection();


// The permission key 'wo_edit' is appropriate for updating/completing work orders.
authorize('wo_edit', $conn); 

header("Content-Type: application/json; charset=UTF-8");
date_default_timezone_set('Asia/Kuala_Lumpur');

$data = json_decode(file_get_contents("php://input"), true);

$id = isset($data['id']) ? intval($data['id']) : (isset($_GET['id']) ? intval($_GET['id']) : 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid Work Order ID."]);
    exit();
}

$conn->begin_transaction();

try {
    // --- START: DURATION CALCULATION LOGIC ---
    $workDuration = $data['workDuration'] ?? null; // Keep existing duration if not completing

    if (isset($data['status']) && $data['status'] === 'Completed') {
        $stmt_get_start_date = $conn->prepare("SELECT actualStartDate FROM workorders WHERE id = ?");
        $stmt_get_start_date->bind_param("i", $id);
        $stmt_get_start_date->execute();
        $result = $stmt_get_start_date->get_result();
        $wo_for_duration = $result->fetch_assoc();
        $stmt_get_start_date->close();
        
        if ($wo_for_duration && !empty($wo_for_duration['actualStartDate'])) {
            $startTime = new DateTime($wo_for_duration['actualStartDate']);
            $endTime = new DateTime(); // Current time
            $durationInterval = $endTime->getTimestamp() - $startTime->getTimestamp();
            $workDuration = $durationInterval; // Duration in seconds
        }
    }
    // --- END: DURATION CALCULATION LOGIC ---

    $checklistJson = json_encode($data['checklist'] ?? []);
    $requiredPartsJson = json_encode($data['requiredParts'] ?? []);
    $wo_type = $data['wo_type'] ?? 'CM';
    $completedDate = ($data['status'] === 'Completed' && empty($data['completedDate'])) ? date('Y-m-d') : ($data['completedDate'] ?? null);

    $stmt_update_wo = $conn->prepare("UPDATE workorders SET title=?, description=?, assetId=?, assignedTo=?, task=?, start_date=?, dueDate=?, priority=?, status=?, breakdownTimestamp=?, checklist=?, requiredParts=?, completionNotes=?, completedDate=?, wo_type=?, workDuration=? WHERE id=?");
    $stmt_update_wo->bind_param("ssiisssssssssssii", 
        $data['title'], $data['description'], $data['assetId'], $data['assignedTo'], 
        $data['task'], $data['start_date'], $data['dueDate'], $data['priority'], 
        $data['status'], $data['breakdownTimestamp'], 
        $checklistJson, $requiredPartsJson, $data['completionNotes'], 
        $completedDate, $wo_type, $workDuration, $id
    );
    $stmt_update_wo->execute();
    $stmt_update_wo->close();
    
    if (isset($data['status']) && $data['status'] === 'Completed') {
        $requiredParts = $data['requiredParts'] ?? [];
        if (!empty($requiredParts) && is_array($requiredParts)) {
            foreach ($requiredParts as $part) {
                $partId = intval($part['partId']);
                $qty_to_deduct = intval($part['quantity']);
                
                $stmt_update_part = $conn->prepare("UPDATE parts SET quantity = quantity - ? WHERE id = ? AND quantity >= ?");
                $stmt_update_part->bind_param("iii", $qty_to_deduct, $partId, $qty_to_deduct);
                $stmt_update_part->execute();

                if ($stmt_update_part->affected_rows === 0) {
                    $partNameStmt = $conn->prepare("SELECT name FROM parts WHERE id = ?");
                    $partNameStmt->bind_param("i", $partId);
                    $partNameStmt->execute();
                    $partName = $partNameStmt->get_result()->fetch_assoc()['name'] ?? "ID $partId";
                    $partNameStmt->close();
                    
                    $conn->rollback();
                    http_response_code(409);
                    echo json_encode([
                        "error_code" => "INSUFFICIENT_STOCK",
                        "message" => "Cannot complete Work Order. Not enough stock for part: '$partName'."
                    ]);
                    exit();
                }
                $stmt_update_part->close();
            }
        }
    }

    $conn->commit();
    http_response_code(200);
    echo json_encode(["message" => "Work Order updated successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update Work Order: " . $e->getMessage()]);
}

$conn->close();
?>