<?php
// backend/generate_pm_work_orders.php (DEBUGGING VERSION)
require_once 'auth_check.php';
authorize(['Admin', 'Manager', 'Supervisor']);

header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// --- START DEBUGGING SETUP ---
$debug_log = []; // We will store our debug messages here.
$today = new DateTime();
$today->setTime(0, 0, 0); 
// --- END DEBUGGING SETUP ---

$schedules_result = $conn->query("SELECT * FROM pm_schedules WHERE is_active = 1");
if (!$schedules_result) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to retrieve PM schedules.']);
    exit();
}

$schedules = $schedules_result->fetch_all(MYSQLI_ASSOC);

foreach ($schedules as $schedule) {
    $schedule_id = $schedule['id'];
    $current_log = ["schedule_id" => $schedule_id, "title" => $schedule['title']];

    $schedule_start_date = new DateTime($schedule['schedule_start_date']);
    $schedule_start_date->setTime(0,0,0);
    
    $current_log['check_1_start_date'] = "Comparing Today (" . $today->format('Y-m-d') . ") with Schedule Start Date (" . $schedule_start_date->format('Y-m-d') . ")";

    if ($today < $schedule_start_date) {
        $current_log['check_1_result'] = "SKIPPED - Start date has not been reached.";
        $debug_log[] = $current_log;
        continue;
    }
    $current_log['check_1_result'] = "OK - Start date has been reached.";

    $is_due = false;
    $last_gen_date_str = $schedule['last_generated_date'];
    $current_log['check_2_last_generated'] = "Last generated date is: " . ($last_gen_date_str ?? 'NULL');

    if ($last_gen_date_str === null) {
        $is_due = true;
        $current_log['check_2_result'] = "IS DUE - Reason: Never been generated before.";
    } else {
        $next_due_date = new DateTime($last_gen_date_str);
        $next_due_date->setTime(0,0,0);
        
        $current_log['next_due_calculation'] = "Calculating next due date from " . $next_due_date->format('Y-m-d') . " with frequency '" . $schedule['frequency'] . "'";
        
        switch ($schedule['frequency']) {
            case 'Weekly': $next_due_date->modify('+1 week'); break;
            case 'Monthly': $next_due_date->modify('+1 month'); break;
            case 'Quarterly': $next_due_date->modify('+3 months'); break;
            case 'Yearly': $next_due_date->modify('+1 year'); break;
        }
        $current_log['next_due_date'] = $next_due_date->format('Y-m-d');
        
        if ($today >= $next_due_date) {
            $is_due = true;
            $current_log['check_2_result'] = "IS DUE - Reason: Today is on or after the calculated next due date.";
        } else {
            $current_log['check_2_result'] = "NOT DUE - Reason: Today is before the calculated next due date.";
        }
    }
    
    $current_log['final_decision'] = $is_due ? "Would generate WO." : "Would NOT generate WO.";
    $debug_log[] = $current_log;
}

$conn->close();
http_response_code(200);
// Instead of the count, we now return the entire debug log.
echo json_encode($debug_log);
?>