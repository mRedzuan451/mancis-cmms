<?php
// backend/generate_pm_work_orders.php (Final Version)
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$generated_count = 0;
$today = new DateTime();
$today->setTime(0, 0, 0); 
$today_str = $today->format('Y-m-d');

$schedules_result = $conn->query("SELECT * FROM pm_schedules WHERE is_active = 1");
if (!$schedules_result) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to retrieve PM schedules.']);
    exit();
}

$schedules = $schedules_result->fetch_all(MYSQLI_ASSOC);

foreach ($schedules as $schedule) {
    $schedule_start_date = new DateTime($schedule['schedule_start_date']);
    $schedule_start_date->setTime(0,0,0);

    if ($today < $schedule_start_date) {
        continue;
    }

    $is_due = false;
    $last_gen_date_str = $schedule['last_generated_date'];

    if ($last_gen_date_str === null) {
        $is_due = true;
    } else {
        $next_due_date = new DateTime($last_gen_date_str);
        $next_due_date->setTime(0,0,0);
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

    if ($is_due) {
        $conn->begin_transaction();
        try {
            // --- THIS ENTIRE BLOCK IS THE FIX ---
            // Dynamically calculate a reasonable due date based on the frequency.
            // This gives the team some lead time to complete the task.
            $dueDateBuffer = '+7 days'; // Default for Weekly and Monthly tasks
            switch ($schedule['frequency']) {
                case 'Quarterly':
                    $dueDateBuffer = '+14 days';
                    break;
                case 'Yearly':
                    $dueDateBuffer = '+30 days';
                    break;
            }
            $new_due_date = (new DateTime())->modify($dueDateBuffer)->format('Y-m-d');

            // The rest of the logic remains the same.
            $wo_priority = 'Medium';
            $wo_status = 'Open';
            $wo_type = 'PM';
            $checklistJson = json_encode($schedule['checklist']);
            $requiredPartsJson = json_encode($schedule['requiredParts']);

            $stmt_insert = $conn->prepare(
                "INSERT INTO workorders (title, description, assetId, assignedTo, task, dueDate, priority, frequency, status, checklist, requiredParts, wo_type) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt_insert->bind_param("ssiissssssss", 
                $schedule['title'], $schedule['description'], $schedule['assetId'], 
                $schedule['assignedTo'], $schedule['task'], $new_due_date,
                $wo_priority, $schedule['frequency'], $wo_status,
                $checklistJson, $requiredPartsJson, $wo_type
            );
            $stmt_insert->execute();
            $stmt_insert->close();
            
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