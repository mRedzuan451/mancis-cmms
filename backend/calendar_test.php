<?php
// This is a standalone test file to see how the calendar tool behaves.
header('Content-Type: text/plain'); // Set to plain text for easy copying

/**
 * This is the same robust function from our last attempt.
 * It takes a local date string and converts it to a UTC datetime string.
 */
function get_utc_datetime_string($dateString) {
    try {
        $local_datetime = new DateTime($dateString . ' 09:00:00', new DateTimeZone('Asia/Kuala_Lumpur'));
        $local_datetime->setTimezone(new DateTimeZone('UTC'));
        return $local_datetime->format('Ymd\THi');
    } catch (Exception $e) {
        return null;
    }
}

// --- TEST CASES ---

// Test Case 1: The date that is causing problems
$date1 = '2025-07-21';
$utc1 = get_utc_datetime_string($date1);
echo "print(generic_calendar.create(title='Test 1: The Failing Date (July 21)', start_datetime='$utc1'))\n";

// Test Case 2: The day we expect the event to wrongly appear on
$date2 = '2025-07-22';
$utc2 = get_utc_datetime_string($date2);
echo "print(generic_calendar.create(title='Test 2: The Offset Date (July 22)', start_datetime='$utc2'))\n";

// Test Case 3: The day before the failing date
$date3 = '2025-07-20';
$utc3 = get_utc_datetime_string($date3);
echo "print(generic_calendar.create(title='Test 3: The Day Before (July 20)', start_datetime='$utc3'))\n";

?>