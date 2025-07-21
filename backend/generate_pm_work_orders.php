<?php
require_once 'auth_check.php';
require_once 'calendar_integration.php';

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

authorize('wo_create', $conn);

header("Content-Type: application/json; charset=UTF-8");

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
    $base_date_str = $schedule['last_generated_date'] ?? $schedule['schedule_start_date'];

    if (empty($base_date_str) || $base_date_str === '0000-00-00') {
        continue;
    }

    $next_pm_date = new DateTime($base_date_str);
    
    if ($schedule['last_generated_date'] !== null) {
        $interval = $schedule['frequency_interval'];
        $unit = $schedule['frequency_unit'];
        $next_pm_date->modify("+$interval $unit");
    }

    if ($today >= $next_pm_date) {
        $conn->begin_transaction();
        try {
            $new_start_date_str = $next_pm_date->format('Y-m-d');
            $buffer = $schedule['due_date_buffer'] ?? 7;
            $new_due_date = (clone $next_pm_date)->modify("+$buffer day")->format('Y-m-d');

            $wo_priority = 'Medium';
            $wo_status = 'Open';
            $wo_type = 'PM';
            $checklistJson = '[]';
            $requiredPartsJson = '[]';
            
            $frequency_text = "{$schedule['frequency_interval']} {$schedule['frequency_unit']}(s)";

            addEventToCalendar($schedule['title'], $new_start_date_str);

            $stmt_insert = $conn->prepare(
                "INSERT INTO workorders (title, description, assetId, assignedTo, task, start_date, dueDate, priority, frequency, status, checklist, requiredParts, wo_type, pm_schedule_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );

            $stmt_insert->bind_param("ssiisssssssssi", 
                $schedule['title'], 
                $schedule['description'], 
                $schedule['assetId'], 
                $schedule['assignedTo'], 
                $schedule['task'], 
                $new_start_date_str,
                $new_due_date,
                $wo_priority, 
                $frequency_text, 
                $wo_status,
                $checklistJson, 
                $requiredPartsJson,
                $wo_type,
                $schedule['id']
            );
            $stmt_insert->execute();
            $stmt_insert->close();
            
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