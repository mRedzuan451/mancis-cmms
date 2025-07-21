<?php
/**
 * get_public_locations.php
 * A public endpoint to fetch division and department lists for user registration.
 * This script does NOT require authentication.
 */

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servername = "localhost"; $username = "root"; $password = ""; $dbname = "mancis_db";
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(503); // Service Unavailable
    echo json_encode(["message" => "Database service is currently unavailable."]);
    exit();
}

/**
 * A helper function to fetch data from a given table.
 */
function fetch_table($conn, $tableName) {
    $sql = "SELECT * FROM " . $tableName;
    $result = $conn->query($sql);
    $data = [];
    if ($result && $result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            // Ensure ID fields are integers for consistency
            foreach ($row as $key => &$value) {
                if (strpos($key, 'Id') !== false || $key === 'id') {
                    $value = intval($value);
                }
            }
            $data[] = $row;
        }
    }
    return $data;
}

// For registration, we only need divisions and departments.
$locations = [
    "divisions" => fetch_table($conn, "divisions"),
    "departments" => fetch_table($conn, "departments"),
];

$conn->close();
echo json_encode($locations);
?>