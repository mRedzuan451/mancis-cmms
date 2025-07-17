<?php
/**
 * A helper function to add an event to a calendar.
 *
 * @param string $title The title of the calendar event.
 * @param string $dateString The date of the event in 'YYYY-MM-DD' format from your application.
 */
function addEventToCalendar($title, $dateString) {
    // First, validate the incoming date to prevent errors.
    if (empty($title) || empty($dateString) || $dateString === '0000-00-00') {
        return;
    }

    try {
        // --- THIS IS THE CORRECTED LOGIC ---

        // Step 1: Create a full DateTime object from your date string.
        // We explicitly state that this date/time is in your local 'Asia/Kuala_Lumpur' timezone.
        // We will use 9:00 AM as the default time for the event.
        $local_datetime = new DateTime($dateString . ' 09:00:00', new DateTimeZone('Asia/Kuala_Lumpur'));

        // Step 2: Convert the local DateTime object to the universal UTC timezone.
        // This is the crucial step that removes all ambiguity for the calendar tool.
        $local_datetime->setTimezone(new DateTimeZone('UTC'));

        // Step 3: Format the new UTC time into the 'yyyymmddTHHMM' string
        // that the calendar tool requires.
        $utc_datetime_string = $local_datetime->format('Ymd\THi');

        // This placeholder now uses the correctly converted UTC time.
        // When you use a real calendar API, you will use the $utc_datetime_string variable.
        error_log("Calendar Event Sync: Title='$title', Final UTC DateTime String Sent to Tool='$utc_datetime_string'");

    } catch (Exception $e) {
        // Log any errors during date processing without crashing the script.
        error_log("Error during date conversion for calendar: " . $e->getMessage());
    }
}
?>