<?php
// backend/generate_pm_work_orders.php

require_once 'auth_check.php';
require_once 'calendar_integration.php'; // Include the new helper
authorize(['Admin', 'Manager', 'Supervisor']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

date_default_timezone_set('Asia/Kuala_Lumpur');

$generated_count = 0;
$today = new DateTime();
$today->setTime(0, 0, 0);

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

    // Skip schedules that haven't started yet
    if ($today < $schedule_start_date) {
        continue;
    }

    // --- FIX 1: Determine the correct start date for the NEXT PM ---
    // If a WO has never been generated, the next one starts on the schedule_start_date.
    // Otherwise, it starts based on the last generation date plus the frequency.
    $last_gen_date_str = $schedule['last_generated_date'];
    $next_pm_date = $last_gen_date_str === null 
        ? $schedule_start_date 
        : (new DateTime($last_gen_date_str))->setTime(0,0,0);

    if ($last_gen_date_str !== null) {
        switch ($schedule['frequency']) {
            case 'Weekly': $next_pm_date->modify('+1 week'); break;
            case 'Monthly': $next_pm_date->modify('+1 month'); break;
            case 'Quarterly': $next_pm_date->modify('+3 months'); break;
            case 'Yearly': $next_pm_date->modify('+1 year'); break;
        }
    }

    // Generate a WO only if today is on or after the calculated next PM date
    if ($today >= $next_pm_date) {
        $conn->begin_transaction();
        try {
            // --- FIX 2: Define both start_date and dueDate for the new WO ---
            $new_start_date_str = $next_pm_date->format('Y-m-d');
            
            $dueDateBuffer = '+7 days'; // Default for Weekly and Monthly
            if ($schedule['frequency'] === 'Quarterly') $dueDateBuffer = '+14 days';
            if ($schedule['frequency'] === 'Yearly') $dueDateBuffer = '+30 days';
            
            $new_due_date_str = (clone $next_pm_date)->modify($dueDateBuffer)->format('Y-m-d');

            $wo_priority = 'Medium';
            $wo_status = 'Open';
            $wo_type = 'PM';
            $checklistJson = $schedule['checklist'] ? json_encode($schedule['checklist']) : '[]';
            $requiredPartsJson = $schedule['requiredParts'] ? json_encode($schedule['requiredParts']) : '[]';

            addEventToCalendar($schedule['title'], $new_start_date_str);

            // --- FIX 3: Add `start_date` to the INSERT query ---
            $stmt_insert = $conn->prepare(
                "INSERT INTO workorders (title, description, assetId, assignedTo, task, start_date, dueDate, priority, frequency, status, checklist, requiredParts, wo_type, pm_schedule_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );

            // --- FIX 4: Bind the new `$new_start_date_str` to the query ---
            $stmt_insert->bind_param("ssiisssssssssi", 
                $schedule['title'], 
                $schedule['description'], 
                $schedule['assetId'], 
                $schedule['assignedTo'], 
                $schedule['task'], 
                $new_start_date_str, // This is the new start date
                $new_due_date_str,   // This is the new due date
                $wo_priority, 
                $schedule['frequency'], 
                $wo_status,
                $checklistJson, 
                $requiredPartsJson,
                $wo_type,
                $schedule['id']
            );
            $stmt_insert->execute();
            $stmt_insert->close();
            
            // Update the schedule's `last_generated_date` to the start date of the WO we just created
            $stmt_update = $conn->prepare("UPDATE pm_schedules SET last_generated_date = ? WHERE id = ?");
            $stmt_update->bind_param("si", $new_start_date_str, $schedule['id']);
            $stmt_update->execute();
            $stmt_update->close();
            
            $conn->commit();
            $generated_count++;
            
        } catch (Exception $e) {
            $conn->rollback();
            // Log errors for debugging instead of echoing them
            error_log("Failed to generate PM for schedule ID " . $schedule['id'] . ": " . $e->getMessage());
        }
    }
}

$conn->close();
http_response_code(200);
echo json_encode(['message' => "Process complete. Generated $generated_count new PM work orders."]);
?>