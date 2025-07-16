<?php
// backend/generate_pm_work_orders.php
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$generated_count = 0;
$today = new DateTime();
$today_str = $today->format('Y-m-d');

// Get all active PM schedules
$schedules_result = $conn->query("SELECT * FROM pm_schedules WHERE is_active = 1");
if (!$schedules_result) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to retrieve PM schedules.']);
    exit();
}

$schedules = $schedules_result->fetch_all(MYSQLI_ASSOC);

foreach ($schedules as $schedule) {
    $schedule_start_date = new DateTime($schedule['schedule_start_date']);

    // 1. Skip if the schedule's start date hasn't been reached yet.
    if ($today < $schedule_start_date) {
        continue;
    }

    $is_due = false;
    $last_gen_date_str = $schedule['last_generated_date'];

    // 2. Determine if the WO is due
    if ($last_gen_date_str === null) {
        $is_due = true;
    } else {
        $next_due_date = new DateTime($last_gen_date_str);
        switch ($schedule['frequency']) {
            case 'Weekly': $next_due_date->modify('+1 week'); break;
            case 'Monthly': $next_due_date->modify('+1 month'); break;
            case 'Quarterly': $next_due_date->modify('+3 months'); break;
            case 'Yearly': $next_due_date->modify('+1 year'); break;
        }
        if ($today >= $next_due_date) {
            $is_due = true;
        }
    }

    // 3. If it's due, generate the WO and update the schedule
    if ($is_due) {
        $conn->begin_transaction();
        try {
            // --- THIS ENTIRE BLOCK IS THE FIX ---

            // Define all values for the new work order
            $new_due_date = (new DateTime())->modify('+7 days')->format('Y-m-d');
            $wo_priority = 'Medium';
            $wo_status = 'Open';
            $wo_type = 'PM';
            $checklistJson = json_encode($schedule['checklist']);
            $requiredPartsJson = json_encode($schedule['requiredParts']);

            $stmt_insert = $conn->prepare(
                "INSERT INTO workorders (title, description, assetId, assignedTo, task, dueDate, priority, frequency, status, checklist, requiredParts, wo_type) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );

            // Bind all 12 parameters correctly
            $stmt_insert->bind_param("ssiissssssss", 
                $schedule['title'], 
                $schedule['description'], 
                $schedule['assetId'], 
                $schedule['assignedTo'], 
                $schedule['task'], 
                $new_due_date,
                $wo_priority, 
                $schedule['frequency'], 
                $wo_status,
                $checklistJson, 
                $requiredPartsJson,
                $wo_type
            );
            $stmt_insert->execute();
            $stmt_insert->close();
            
            // This part remains the same
            $stmt_update = $conn->prepare("UPDATE pm_schedules SET last_generated_date = ? WHERE id = ?");
            $stmt_update->bind_param("si", $today_str, $schedule['id']);
            $stmt_update->execute();
            $stmt_update->close();
            
            $conn->commit();
            $generated_count++;
            
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Failed to generate PM for schedule ID " . $schedule['id'] . ": " . $e->getMessage());
        }
    }
}

$conn->close();
http_response_code(200);
echo json_encode(['message' => "Process complete. Generated $generated_count new PM work orders."]);
?>