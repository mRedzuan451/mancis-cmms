<?php
// backend/location_helper.php

/**
 * Finds the department ID for a given location string (e.g., 'pl-5', 'box-12').
 * @param string $locationId The location identifier.
 * @param mysqli $conn The database connection object.
 * @return int|null The department ID, or null if not found.
 */
function getDepartmentIdFromLocation($locationId, $conn) {
    if (empty($locationId) || strpos($locationId, '-') === false) {
        return null;
    }

    list($type, $id) = explode('-', $locationId, 2);
    $id = intval($id);
    $departmentId = null;

    if ($type === 'pl') { // Production Line
        $sql = "SELECT d.id FROM departments d
                JOIN sublines sl ON d.id = sl.departmentId
                JOIN productionlines pl ON sl.id = pl.subLineId
                WHERE pl.id = ?";
    } else if ($type === 'box') { // Storage Box
        $sql = "SELECT d.id FROM departments d
                JOIN cabinets cab ON d.id = cab.departmentId
                JOIN shelves sh ON cab.id = sh.cabinetId
                JOIN boxes b ON sh.id = b.shelfId
                WHERE b.id = ?";
    } else if ($type === 'sh') { // Shelf
        $sql = "SELECT d.id FROM departments d
                JOIN cabinets cab ON d.id = cab.departmentId
                JOIN shelves sh ON cab.id = sh.cabinetId
                WHERE sh.id = ?";
    } else if ($type === 'cab') { // Cabinet
        $sql = "SELECT departmentId as id FROM cabinets WHERE id = ?";
    } else {
        return null; // Not a location type that contains assets/parts
    }

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $result ? (int)$result['id'] : null;
}