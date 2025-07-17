<?php
// Special Debugging Version

// --- HELPER FUNCTION TO LOG PROGRESS ---
function custom_log($message) {
    // This will create a file named 'debug_log.txt' in the same directory.
    // Make sure your server has permission to write files in this folder.
    file_put_contents('debug_log.txt', date('[Y-m-d H:i:s] ') . $message . "\n", FILE_APPEND);
}

// Clear the log for a new test run
file_put_contents('debug_log.txt', '');

custom_log("--- SCRIPT EXECUTION STARTED ---");

require_once 'auth_check.php';
custom_log("Auth check passed.");

authorize(['Admin', 'Manager', 'Supervisor', 'Engineer', 'Technician']);
custom_log("Authorization passed.");


function isValidDateString($dateStr) {
    if (empty($dateStr) || $dateStr === '0000-00-00') {
        return false;
    }
    $d = DateTime::createFromFormat('Y-m-d', $dateStr);
    return $d && $d->format('Y-m-d') === $dateStr;
}

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { 
    custom_log("FATAL: DB Connection failed: " . $conn->connect_error);
    die("Connection failed: " . $conn->connect_error); 
}
custom_log("Database connection successful.");

$data = json_decode(file_get_contents("php://input"));
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
custom_log("Request received for Work Order ID: $id");

if ($id <= 0) {
    custom_log("FATAL: Invalid Work Order ID.");
    http_response_code(400);
    echo json_encode(["message" => "Invalid Work Order ID."]);
    exit();
}

$conn->begin_transaction();
custom_log("Database transaction started.");

try {
    if (isset($data->status) && $data->status === 'Completed') {
        custom_log("Step 1: Entering Part Consumption block.");
        // Part consumption logic...
    }

    custom_log("Step 2: Entering Main Work Order Update block.");
    $checklistJson = json_encode($data->checklist);
    $requiredPartsJson = json_encode($data->requiredParts);
    $data->wo_type = $data->wo_type ?? 'CM';
    $stmt_update_wo = $conn->prepare("UPDATE workorders SET title=?, description=?, assetId=?, assignedTo=?, task=?, start_date=?, dueDate=?, priority=?, frequency=?, status=?, breakdownTimestamp=?, checklist=?, requiredParts=?, completionNotes=?, completedDate=?, wo_type=? WHERE id=?");
    $stmt_update_wo->bind_param("ssiissssssssssssi", $data->title, $data->description, $data->assetId, $data->assignedTo, $data->task, $data->start_date, $data->dueDate, $data->priority, $data->frequency, $data->status, $data->breakdownTimestamp, $checklistJson, $requiredPartsJson, $data->completionNotes, $data->completedDate, $data->wo_type, $id);
    if (!$stmt_update_wo->execute()) { throw new Exception("Failed to update work order details."); }
    $stmt_update_wo->close();
    custom_log("Main Work Order successfully updated in DB.");

    if (isset($data->status) && $data->status === 'Completed' && isset($data->wo_type) && $data->wo_type === 'PM') {
        custom_log("Step 3: Entering PM Re-generation block.");
        $stmt_get_schedule_id = $conn->prepare("SELECT pm_schedule_id FROM workorders WHERE id = ?");
        $stmt_get_schedule_id->bind_param("i", $id);
        $stmt_get_schedule_id->execute();
        $completed_wo = $stmt_get_schedule_id->get_result()->fetch_assoc();
        $stmt_get_schedule_id->close();
        $schedule_id = $completed_wo['pm_schedule_id'] ?? null;
        custom_log("Found parent PM Schedule ID: " . ($schedule_id ?? 'None'));

        if ($schedule_id) {
            $stmt_get_schedule = $conn->prepare("SELECT * FROM pm_schedules WHERE id = ? AND is_active = 1");
            $stmt_get_schedule->bind_param("i", $schedule_id);
            $stmt_get_schedule->execute();
            $schedule_result = $stmt_get_schedule->get_result();
            $stmt_get_schedule->close();
            if ($schedule_result->num_rows > 0) {
                $schedule = $schedule_result->fetch_assoc();
                custom_log("Parent schedule data fetched successfully.");
                
                $base_date_str = $schedule['last_generated_date'] ?? $schedule['schedule_start_date'];
                custom_log("Base date for next PM is: '" . ($base_date_str ?? 'NULL') . "'");

                if (isValidDateString($base_date_str)) {
                    custom_log("Base date is valid. Proceeding to generate next WO.");
                    // ... The rest of the generation logic ...
                } else {
                    custom_log("WARNING: Base date is INVALID. Skipping re-generation for this schedule.");
                }
            } else {
                 custom_log("WARNING: Could not find active parent schedule with ID: $schedule_id");
            }
        }
    }
    
    $conn->commit();
    custom_log("--- SCRIPT FINISHED SUCCESSFULLY ---");
    http_response_code(200);
    echo json_encode(["message" => "Work Order updated successfully."]);

} catch (Exception $e) {
    custom_log("--- SCRIPT FAILED WITH AN EXCEPTION ---");
    custom_log("Error message: " . $e->getMessage());
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update Work Order: " . $e->getMessage()]);
}

$conn->close();
?>