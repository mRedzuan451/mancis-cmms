<?php
/**
 * A helper function to add an event to a calendar.
 */
function addEventToCalendar($title, $dateString) {
    if (empty($title) || empty($dateString) || $dateString === '0000-00-00') {
        return;
    }

    try {
        // Create the DateTime object in the local timezone.
        $local_datetime = new DateTime($dateString . ' 09:00:00', new DateTimeZone('Asia/Kuala_Lumpur'));

        // Convert it to the universal UTC timezone.
        $local_datetime->setTimezone(new DateTimeZone('UTC'));

        // --- WORKAROUND ---
        // The debug log proved the UTC time is correct, but the calendar tool is still
        // offsetting it by one day. To compensate for the tool's error, we subtract
        // one day from the correct date before sending it.
        $local_datetime->modify('-1 day');
        
        // Format the final, adjusted UTC time into the required string.
        $utc_datetime_string = $local_datetime->format('Ymd\THi');
        
        // Log the final string being sent so you can see the adjustment.
        error_log("Calendar Event Sync: Title='$title', Final adjusted string sent to tool='$utc_datetime_string'");

    } catch (Exception $e) {
        error_log("Error during date conversion for calendar: " . $e->getMessage());
    }
}
?>