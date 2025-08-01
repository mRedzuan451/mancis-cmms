<?php
// backend/populate_department_ids.php

// Increase execution time limit for safety with large datasets
set_time_limit(300); // 5 minutes

// --- CONFIGURATION ---
$servername = "localhost"; 
$username = "root"; 
$password = ""; 
$dbname = "mancis_db";

// --- DEPENDENCIES ---
require_once 'location_helper.php';

// --- INITIALIZATION ---
header('Content-Type: text/plain');
echo "--- Starting One-Time Department ID Population Script ---\n\n";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die("Connection Failed: " . $conn->connect_error . "\n");
}

$updated_assets = 0;
$updated_parts = 0;
$asset_errors = 0;
$part_errors = 0;

// ==================================================================
//  PROCESS ASSETS
// ==================================================================
echo "Processing ASSETS...\n";

// Prepare the update statement once for efficiency
$stmt_update_asset = $conn->prepare("UPDATE assets SET departmentId = ? WHERE id = ?");

// Fetch all assets that need updating
$assets_result = $conn->query("SELECT id, locationId FROM assets WHERE departmentId IS NULL");

if ($assets_result->num_rows > 0) {
    while ($asset = $assets_result->fetch_assoc()) {
        $departmentId = getDepartmentIdFromLocation($asset['locationId'], $conn);
        
        if ($departmentId !== null) {
            $stmt_update_asset->bind_param("ii", $departmentId, $asset['id']);
            if ($stmt_update_asset->execute()) {
                $updated_assets++;
            } else {
                echo " - FAILED to update asset ID {$asset['id']}\n";
                $asset_errors++;
            }
        } else {
            echo " - WARNING: Could not find department for asset ID {$asset['id']} with location '{$asset['locationId']}'\n";
            $asset_errors++;
        }
    }
    echo " -> Asset processing complete.\n\n";
} else {
    echo " -> No assets needed updating.\n\n";
}
$stmt_update_asset->close();


// ==================================================================
//  PROCESS PARTS
// ==================================================================
echo "Processing PARTS...\n";

// Prepare the update statement once for efficiency
$stmt_update_part = $conn->prepare("UPDATE parts SET departmentId = ? WHERE id = ?");

// Fetch all parts that need updating
$parts_result = $conn->query("SELECT id, locationId FROM parts WHERE departmentId IS NULL");

if ($parts_result->num_rows > 0) {
    while ($part = $parts_result->fetch_assoc()) {
        $departmentId = getDepartmentIdFromLocation($part['locationId'], $conn);
        
        if ($departmentId !== null) {
            $stmt_update_part->bind_param("ii", $departmentId, $part['id']);
            if ($stmt_update_part->execute()) {
                $updated_parts++;
            } else {
                echo " - FAILED to update part ID {$part['id']}\n";
                $part_errors++;
            }
        } else {
            echo " - WARNING: Could not find department for part ID {$part['id']} with location '{$part['locationId']}'\n";
            $part_errors++;
        }
    }
    echo " -> Part processing complete.\n\n";
} else {
    echo " -> No parts needed updating.\n\n";
}
$stmt_update_part->close();

// ==================================================================
//  SUMMARY
// ==================================================================
echo "--- SCRIPT FINISHED ---\n";
echo "Summary:\n";
echo " - Assets Updated: $updated_assets\n";
echo " - Parts Updated:  $updated_parts\n";
echo " - Asset Errors/Warnings: $asset_errors\n";
echo " - Part Errors/Warnings:  $part_errors\n\n";
echo "IMPORTANT: Please DELETE this file (populate_department_ids.php) from your server now.\n";

$conn->close();
?>