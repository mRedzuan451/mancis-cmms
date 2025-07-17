<?php
/**
 * A helper function to add an event to a calendar.
 *
 * @param string $title The title of the calendar event.
 * @param string $dateString The date of the event in 'YYYY-MM-DD' format.
 */
function addEventToCalendar($title, $dateString) {
    if (empty($title) || empty($dateString) || $dateString === '0000-00-00') {
        return;
    }

    // --- THIS IS THE FINAL FIX ---

    // 1. Create a DateTime object from the date string, explicitly telling PHP
    //    that this date originates from the 'Asia/Kuala_Lumpur' timezone.
    //    We'll set the time to 9:00 AM.
    $local_time = new DateTime($dateString . ' 09:00:00', new DateTimeZone('Asia/Kuala_Lumpur'));

    // 2. Convert this local time to the universal UTC timezone. This is the crucial step.
    $local_time->setTimezone(new DateTimeZone('UTC'));

    // 3. Format the new UTC time into the 'yyyymmddTHHMM' string that the calendar tool expects.
    $formatted_datetime_utc = $local_time->format('Ymd\THi');


    // This placeholder now uses the correctly converted UTC time.
    // When you integrate with a real calendar API, you will use the $formatted_datetime_utc variable.
    error_log("Calendar Event Sync: Title='$title', StartDateTimeUTC='$formatted_datetime_utc'");
}
?>