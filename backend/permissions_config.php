<?php

// This is the master list of all permissions available in the system.
$permissions = [
    'asset_view'   => 'View Assets',
    'asset_create' => 'Create Assets',
    'asset_edit'   => 'Edit Assets',
    'asset_delete' => 'Delete Assets',
    'asset_transfer' => 'Transfer Assets to New Locations',

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
    'part_restock'        => 'Restock received parts into inventory',

    'pm_schedule_view'    => 'View PM Schedules',
    'pm_schedule_create'  => 'Create/Edit PM Schedules',
    'pm_schedule_delete'  => 'Delete PM Schedules',

    'user_view'    => 'View Users',
    'user_edit'    => 'Edit User Roles & Permissions',
    'user_delete'  => 'Delete Users',

    'location_management' => 'Manage Locations (Add/Delete)',
    'report_view'         => 'View Reports',
    'log_view'            => 'View Activity Log',

    'stock_take_create'   => 'Initiate and perform stock takes',
    'stock_take_approve'  => 'Approve and finalize stock takes',
    'stock_take_delete'   => 'Delete stock take sessions',

    'feedback_view'       => 'View feedback inbox',
    'feedback_delete'     => 'Delete feedback messages',
    'report_cost_view'    => 'View maintenance cost reports',
    'report_kpi_view'     => 'View maintenance KPI reports',
];

$role_permissions = [
    'Admin' => array_keys($permissions), // Admins get all permissions

    'Manager' => [
        'asset_view', 'asset_create', 'asset_edit',
        'asset_transfer',
        'part_view', 'part_create', 'part_edit',
        'wo_view', 'wo_create', 'wo_edit',
        'part_request_view', 'part_request_create', 'part_request_approve', 'part_request_delete',
        'pm_schedule_view', 'pm_schedule_create', 'pm_schedule_delete',
        'user_view','user_edit',
        'location_management',
        'report_view', 'feedback_view',
        'stock_take_create', 'stock_take_approve',
        'report_cost_view','report_kpi_view',
    ],

    'Supervisor' => [
        'asset_view', 'asset_create', 'asset_edit',
        'part_view', 'part_create', 'part_edit',
        'wo_view', 'wo_create', 'wo_edit',
        'part_request_view', 'part_request_create', 'part_request_approve',
        'pm_schedule_view', 'pm_schedule_create',
        'user_view','part_restock',
        'location_management', 'feedback_view',
        'stock_take_create', 'stock_take_approve',
        'report_cost_view','report_view','report_kpi_view',
    ],

    'Engineer' => [
        'asset_view', 'asset_edit',
        'part_view', 'part_edit',
        'wo_view', 'wo_edit','wo_create',
        'location_management','part_restock',
        'part_request_view', 'part_request_create',
        'pm_schedule_view','asset_create',
        'pm_schedule_create','stock_take_create',
        'feedback_view',
    ],

    'Technician' => [
        'asset_view',
        'part_view', 'part_edit',
        'wo_view', 'wo_create', 'wo_edit',
        'part_request_view', 'part_request_create','part_create',
        'location_management','part_restock',
        'stock_take_create', 'pm_schedule_view','report_view',
        'pm_schedule_create', 'feedback_view',
    ],

    'Clerk' => [
        'part_request_view', 'part_request_create',
        'location_management','part_restock',
        'stock_take_create', 'part_view', 'feedback_view',
    ],
];
?>