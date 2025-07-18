<?php

// This is the master list of all permissions available in the system.
// The "key" is used in the code, and the "label" is displayed in the UI.
$permissions = [
    'asset_view'   => 'View Assets',
    'asset_create' => 'Create Assets',
    'asset_edit'   => 'Edit Assets',
    'asset_delete' => 'Delete Assets',

    'part_view'    => 'View Parts',
    'part_create'  => 'Create Parts',
    'part_edit'    => 'Edit Parts',
    'part_delete'  => 'Delete Parts',

    'wo_view'      => 'View Work Orders',
    'wo_create'    => 'Create Work Orders',
    'wo_edit'      => 'Edit Work Orders',
    'wo_delete'    => 'Delete Work Orders',
    
    'part_request_view'     => 'View Part Requests',
    'part_request_create'   => 'Create Part Requests',
    'part_request_approve'  => 'Approve/Reject Part Requests',
    'part_request_delete'   => 'Delete Part Requests',

    'pm_schedule_view'    => 'View PM Schedules',
    'pm_schedule_create'  => 'Create/Edit PM Schedules',
    'pm_schedule_delete'  => 'Delete PM Schedules',

    'user_view'    => 'View Users',
    'user_edit'    => 'Edit User Roles & Permissions',
    'user_delete'  => 'Delete Users',

    'location_management' => 'Manage Locations (Add/Delete)',
    'report_view'         => 'View Reports',
    'log_view'            => 'View Activity Log',
];


// This defines the DEFAULT set of permissions for each role.
// An Admin can override these for individual users.
$role_permissions = [
    'Admin' => array_keys($permissions), // Admins get all permissions

    'Manager' => [
        'asset_view', 'asset_create', 'asset_edit',
        'part_view', 'part_create', 'part_edit',
        'wo_view', 'wo_create', 'wo_edit',
        'part_request_view', 'part_request_create', 'part_request_approve', 'part_request_delete',
        'user_view',
        'report_view',
    ],

    'Supervisor' => [
        'asset_view', 'asset_create', 'asset_edit',
        'part_view', 'part_create', 'part_edit',
        'wo_view', 'wo_create', 'wo_edit',
        'part_request_view', 'part_request_create', 'part_request_approve',
        'user_view',
    ],

    'Engineer' => [
        'asset_view', 'asset_edit',
        'part_view', 'part_edit',
        'wo_view', 'wo_edit',
        'part_request_view', 'part_request_create',
    ],

    'Technician' => [
        'asset_view',
        'part_view',
        'wo_view', 'wo_create', 'wo_edit',
        'part_request_view', 'part_request_create',
    ],

    'Clerk' => [
        'part_request_view', 'part_request_create',
    ],
];

?>