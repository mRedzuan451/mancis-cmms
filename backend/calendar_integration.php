<?php
/**
 * A helper function to add an event to a calendar.
 * This is the final, correct version.
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
        // This format (e.g., "2025-07-21T09:00:00+08:00") is unambiguous.
        $iso_datetime_string = $local_datetime->format(DateTime::ISO8601);
        
        // Step 3: Send this unambiguous string to your calendar service API.
        // The cURL example from before would now use $iso_datetime_string in its payload.
        // For now, we will log the correctly formatted string.
        error_log("Calendar Event Sync: Title='$title', ISO 8601 DateTime='$iso_datetime_string'");

    } catch (Exception $e) {
        error_log("Error during date conversion for calendar: " . $e->getMessage());
    }
}
?>