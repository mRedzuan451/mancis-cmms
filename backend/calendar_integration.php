<?php
/**
 * A helper function to add an event to a calendar.
 * This is the final, correct version using the unambiguous ISO 8601 format.
 */
function addEventToCalendar($title, $dateString) {
    if (empty($title) || empty($dateString) || $dateString === '0000-00-00') {
        return;
    }

    try {
        // Step 1: Create a DateTime object, explicitly stating it is in your local timezone.
        // We will use 9:00 AM as the event time.
        $local_datetime = new DateTime($dateString . ' 09:00:00', new DateTimeZone('Asia/Kuala_Lumpur'));

        // Step 2: Format the date into the full ISO 8601 standard.
        // The output string will look like "2025-07-21T09:00:00+0800".
        // This is the correct, unambiguous format that all modern calendar systems understand.
        $iso_datetime_string = $local_datetime->format(DateTime::ISO8601);
        
        // Step 3: Log the correctly formatted string. When you connect to a real
        // calendar API, you will send the $iso_datetime_string in your request.
        error_log("Calendar Event Sync: Title='$title', ISO 8601 DateTime='$iso_datetime_string'");

    } catch (Exception $e) {
        error_log("Error during date conversion for calendar: " . $e->getMessage());
    }
}
?>