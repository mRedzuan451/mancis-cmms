<?php
/**
 * A helper function to add an event to a calendar (DEBUGGING VERSION).
 */
function addEventToCalendar($title, $dateString) {
    // This logs the raw date string this function receives from the calling script.
    custom_log("TRACE 1: addEventToCalendar() received dateString = '$dateString'");

    if (empty($title) || empty($dateString) || $dateString === '0000-00-00') {
        custom_log("TRACE 2: Date is invalid or empty. Aborting calendar event creation.");
        return;
    }

    try {
        // This logs the date and timezone it's about to create.
        custom_log("TRACE 3: Creating DateTime object for date '$dateString' in timezone 'Asia/Kuala_Lumpur'.");
        $local_datetime = new DateTime($dateString . ' 09:00:00', new DateTimeZone('Asia/Kuala_Lumpur'));
        custom_log("TRACE 4: Local time successfully created. Full value is: " . $local_datetime->format(DateTime::ISO8601));

        // This logs the UTC conversion step.
        custom_log("TRACE 5: Converting the above time to UTC timezone.");
        $local_datetime->setTimezone(new DateTimeZone('UTC'));
        custom_log("TRACE 6: UTC time is now: " . $local_datetime->format(DateTime::ISO8601));

        // This logs the final string that would be sent to the calendar tool.
        $utc_datetime_string = $local_datetime->format('Ymd\THi');
        custom_log("TRACE 7: Final formatted string for calendar tool is: '$utc_datetime_string'");

    } catch (Exception $e) {
        custom_log("FATAL ERROR in calendar_integration.php: " . $e->getMessage());
    }
}
?>