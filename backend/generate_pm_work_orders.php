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
    $is_due = false;
    $last_gen_date_str = $schedule['last_generated_date'];

    if ($last_gen_date_str === null) {
        // If it has never been generated, it's due now.
        $is_due = true;
    } else {
        // Calculate the next due date based on the last generation and frequency
        $last_gen_date = new DateTime($last_gen_date_str);
        switch ($schedule['frequency']) {
            case 'Weekly': $last_gen_date->modify('+1 week'); break;
            case 'Monthly': $last_gen_date->modify('+1 month'); break;
            case 'Quarterly': $last_gen_date->modify('+3 months'); break;
            case 'Yearly': $last_gen_date->modify('+1 year'); break;
        }
        // If today is on or after the next due date, it's due.
        if ($today >= $last_gen_date) {
            $is_due = true;
        }
    }

    if ($is_due) {
        $conn->begin_transaction();
        try {
            // A new WO is due, so create it.
            $new_due_date = (new DateTime())->modify('+7 days')->format('Y-m-d'); // Set due date 7 days from now
            
            $stmt_insert = $conn->prepare(
                "INSERT INTO workorders (title, description, assetId, assignedTo, task, dueDate, priority, frequency, status, checklist, requiredParts, wo_type) 
                 VALUES (?, ?, ?, ?, ?, ?, 'Medium', ?, 'Open', ?, ?, 'PM')"
            );
            $stmt_insert->bind_param("ssiisssss", 
                $schedule['title'], $schedule['description'], $schedule['assetId'], 
                $schedule['assignedTo'], $schedule['task'], $new_due_date, 
                $schedule['frequency'], $schedule['checklist'], $schedule['requiredParts']
            );
            $stmt_insert->execute();
            $stmt_insert->close();
            
            // Now, update the schedule's last_generated_date to today
            $stmt_update = $conn->prepare("UPDATE pm_schedules SET last_generated_date = ? WHERE id = ?");
            $stmt_update->bind_param("si", $today_str, $schedule['id']);
            $stmt_update->execute();
            $stmt_update->close();
            
            $conn->commit();
            $generated_count++;
            
        } catch (Exception $e) {
            $conn->rollback();
            // Log this error or handle it as needed, but continue to the next schedule
            error_log("Failed to generate PM for schedule ID " . $schedule['id'] . ": " . $e->getMessage());
        }
    }
}

$conn->close();
http_response_code(200);
echo json_encode(['message' => "Process complete. Generated $generated_count new PM work orders."]);
?>