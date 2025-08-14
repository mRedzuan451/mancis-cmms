<?php
/**
 * get_public_locations.php
 * A public endpoint to fetch division and department lists for user registration.
 * This script does NOT require authentication.
 */

require_once 'database.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$conn = getDbConnection();

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