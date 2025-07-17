<?php
/**
 * A helper function to add an event to a calendar via an API.
 *
 * @param string $title The title of the calendar event.
 * @param string $dateString The date of the event in 'YYYY-MM-DD' format.
 */
function addEventToCalendar($title, $dateString) {
    // 1. Validate the input to avoid errors with bad data.
    if (empty($title) || empty($dateString) || $dateString === '0000-00-00') {
        return; // Do not proceed if the data is invalid.
    }

    // --- This is where you call the actual Calendar API ---
    // Below is a standard example using cURL in PHP. You would need to
    // replace the URL, headers, and data structure to match the specific
    // calendar service you want to use (e.g., Google Calendar, Outlook).

    /*
    // 1. The API endpoint for creating an event.
    $apiUrl = 'https://api.examplecalendar.com/v1/events';

    // 2. The data for the new event, formatted as a PHP array.
    //    The structure of this array depends entirely on the calendar service's requirements.
    $eventData = [
        'summary' => $title,
        'start' => [
            'dateTime' => $dateString . 'T09:00:00', // Standard ISO 8601 Format
            'timeZone' => 'Asia/Kuala_Lumpur',
        ],
        'end' => [
            'dateTime' => $dateString . 'T10:00:00', // Example: 1-hour duration
            'timeZone' => 'Asia/Kuala_Lumpur',
        ]
    ];

    // 3. Initialize a cURL session.
    $ch = curl_init($apiUrl);

    // 4. Set the options for the cURL request.
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // Return the response as a string
    curl_setopt($ch, CURLOPT_POST, true); // Set the request method to POST
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($eventData)); // Send the data as a JSON string
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer YOUR_API_KEY_HERE' // The API Key for authentication
    ]);

    // 5. Execute the request and get the response from the calendar server.
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // 6. Log the result for your own debugging purposes.
    if ($http_code >= 400) {
        error_log("Calendar API Error: Failed to create event '$title'. Response Code: $http_code. Response: $response");
    } else {
        error_log("Calendar Event Sync Success: Created event '$title'.");
    }
    */

    // For now, we can leave the simple log in place until you choose a calendar service.
    $formatted_datetime = str_replace('-', '', $dateString) . 'T0900';
    error_log("Intended Calendar Event Sync: Title='$title', StartDateTime='$formatted_datetime'");
}
?>