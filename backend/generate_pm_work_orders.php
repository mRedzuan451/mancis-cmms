<?php
require_once 'auth_check.php';
require_once 'calendar_integration.php'; // For calendar updates
authorize(['Admin', 'Manager', 'Supervisor']);

header("Content-Type: application/json; charset=UTF-8");

// Set the correct timezone for all date calculations
date_default_timezone_set('Asia/Kuala_Lumpur');

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

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
    $base_date_str = $schedule['last_generated_date'] ?? $schedule['schedule_start_date'];

    if (empty($base_date_str) || $base_date_str === '0000-00-00') {
        continue; // Skip schedules with no valid start date
    }

    $next_pm_date = new DateTime($base_date_str);
    
    // For subsequent WOs, add the frequency interval. If it's the first one, use the base date itself.
    if ($schedule['last_generated_date'] !== null) {
        $interval = $schedule['frequency_interval'];
        $unit = $schedule['frequency_unit'];
        $next_pm_date->modify("+$interval $unit");
    }

    // Generate a WO only if today is on or after the calculated next PM date
    if ($today >= $next_pm_date) {
        $conn->begin_transaction();
        try {
            // --- THIS IS THE FIX ---
            // 1. The start date is correctly defined from the calculated next PM date.
            $new_start_date_str = $next_pm_date->format('Y-m-d');
            
            // 2. The due date is calculated using the custom buffer.
            $buffer = $schedule['due_date_buffer'] ?? 7; // Default to 7 days if not set
            $new_due_date = (clone $next_pm_date)->modify("+$buffer day")->format('Y-m-d');

            // 3. Set other properties for the new WO.
            $wo_priority = 'Medium';
            $wo_status = 'Open';
            $wo_type = 'PM';
            $checklistJson = '[]';
            $requiredPartsJson = '[]';
            
            // 4. Create the calendar event.
            addEventToCalendar($schedule['title'], $new_start_date_str);

            $stmt_insert = $conn->prepare(
                "INSERT INTO workorders (title, description, assetId, assignedTo, task, start_date, dueDate, priority, frequency, status, checklist, requiredParts, wo_type, pm_schedule_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );

            // This bind statement now correctly uses all defined variables
            $stmt_insert->bind_param("ssiisssssssssi", 
                $schedule['title'], 
                $schedule['description'], 
                $schedule['assetId'], 
                $schedule['assignedTo'], 
                $schedule['task'], 
                $new_start_date_str,
                $new_due_date,
                $wo_priority, 
                "{$schedule['frequency_interval']} {$schedule['frequency_unit']}(s)", 
                $wo_status,
                $checklistJson, 
                $requiredPartsJson,
                $wo_type,
                $schedule['id']
            );
            $stmt_insert->execute();
            $stmt_insert->close();
            
            // 5. Update the schedule's last generated date to the start date of the WO we just created.
            $stmt_update = $conn->prepare("UPDATE pm_schedules SET last_generated_date = ? WHERE id = ?");
            $stmt_update->bind_param("si", $new_start_date_str, $schedule['id']);
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