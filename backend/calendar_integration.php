<?php
/**
 * A helper function to add an event to the calendar.
 * In a real-world application, this function would make a cURL request
 * to a calendar service API. For this example, we are simply logging
 * the intended action, which you can then connect to a tool call.
 *
 * @param string $title The title of the calendar event.
 * @param string $dateString The date of the event in 'YYYY-MM-DD' format.
 */
function addEventToCalendar($title, $dateString) {
    // 1. Validate the input to avoid errors with bad data.
    if (empty($title) || empty($dateString) || $dateString === '0000-00-00') {
        return; // Do not proceed if the data is invalid.
    }

    // 2. The calendar API requires a 'yyyymmddTHHMM' format.
    //    We'll remove the hyphens from the date and append a default time (e.g., 09:00 AM).
    $formatted_datetime = str_replace('-', '', $dateString) . 'T0900';

    // 3. Call the calendar API.
    //    Replace the 'error_log' line below with your actual API call.
    //    For example, if you were using a shell command to run a tool, it might look like:
    //    shell_exec("tool-runner generic_calendar.create --title='$title' --start_datetime='$formatted_datetime'");
    
    error_log("Calendar Event Sync: Title='$title', StartDateTime='$formatted_datetime'");
}
?>