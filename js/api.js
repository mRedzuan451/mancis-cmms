// js/api.js
import { API_URL } from './config.js';

/**
 * A private helper function to make API requests.
 * It is not exported and only used within this module.
 * @param {string} endpoint The API endpoint to call (e.g., 'login.php').
 * @param {object} options The options for the fetch request.
 * @returns {Promise<object>} The JSON response from the server.
 */
// js/api.js

async function request(endpoint, options = {}) {
    try {
        // --- THIS IS THE FIX ---
        // This tells the browser to always send cookies with API requests.
        options.credentials = 'include';

        const response = await fetch(`${API_URL}/${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown server error occurred' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error(`API request failed for ${endpoint}:`, error.message);
        throw error; // Re-throw the error to be caught by the calling function
    }
}

/**
 * An object that exports all the public API functions.
 * Each function now calls the private `request()` helper directly.
 */
export const api = {
    // GET operations
    getAssets: () => request('get_assets.php'),
    getParts: () => request('get_parts.php'),
    getUsers: () => request('get_users.php'),
    getWorkOrders: () => request('get_work_orders.php'),
    getPartRequests: () => request('get_part_requests.php'),
    getLocations: () => request('get_locations.php'),
    getLogs: () => request('get_logs.php'),
    getReceivedParts: () => request('get_received_parts.php'),
    getInventoryReport: (params) => request(`get_inventory_report.php?startDate=${params.startDate}&endDate=${params.endDate}`),
    
    // AUTH operations
    login: (username, password) => request('login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    }),
    createUser: (data) => request('create_user.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateUserRole: (data) => request('update_user_role.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteUser: (id) => request(`delete_user.php?id=${id}`, { method: 'POST' }),

    // LOG operations
    createLog: (data) => request('create_log.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // ASSET operations
    createAsset: (data) => request('create_asset.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateAsset: (id, data) => request(`update_asset.php?id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteAsset: (id) => request(`delete_asset.php?id=${id}`, { method: 'POST' }),

    // PARTS operations
    createPart: (data) => request('create_part.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updatePart: (id, data) => request(`update_part.php?id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deletePart: (id) => request(`delete_part.php?id=${id}`, { method: 'POST' }),

    // WORK ORDER operations
    createWorkOrder: (data) => request('create_work_order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateWorkOrder: (id, data) => request(`update_work_order.php?id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteWorkOrder: (id) => request(`delete_work_order.php?id=${id}`, { method: 'POST' }),

    // LOCATION operations
    createLocation: (data) => request('create_location.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteLocation: (data) => request('delete_location.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // PART REQUEST WORKFLOW operations
    createPartRequest: (data) => request('create_part_request.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updatePartRequestStatus: (data) => request('update_part_request_status.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    receiveParts: (data) => request('receive_parts.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    restockParts: (data) => request('restock_parts.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // --- THIS IS THE NEW FUNCTION ---
    createAutoPartRequest: (data) => request('create_auto_part_request.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    directRestockPart: (data) => request('direct_restock.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getNotifications: () => request('get_notifications.php'),
    markNotificationsRead: (data) => request('mark_notifications_read.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updatePartRequest: (id, data) => request(`update_part_request.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
    }),
    deletePartRequest: (id) => request(`delete_part_request.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    }),
    getPmSchedules: () => request('get_pm_schedules.php'),
    getPublicLocations: () => request('get_public_locations.php'),
    createPmSchedule: (data) => request('create_pm_schedule.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updatePmSchedule: (id, data) => request(`update_pm_schedule.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
    }),
    deletePmSchedule: (id) => request(`delete_pm_schedule.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    }),
    generatePmWorkOrders: () => request('generate_pm_work_orders.php', { method: 'POST' }),
    // Add these new functions inside the `export const api = { ... };` object

    getPermissions: () => request('get_permissions.php'),
    getUserPermissions: (userId) => request(`get_user_permissions.php?user_id=${userId}`),
    updateUserPermissions: (data) => request('update_user_permissions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    bulkUpdateAssets: (data) => request('bulk_update_assets.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),   
    // --- ADD THIS NEW FUNCTION ---
    bulkUpdateParts: (data) => request('bulk_update_parts.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getStockTakes: () => request('get_stock_takes.php'),
    getStockTakeDetails: (id) => request(`get_stock_take_details.php?id=${id}`),
    startStockTake: () => request('start_stock_take.php', { method: 'POST' }),
    saveStockTake: (data) => request('save_stock_take.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    approveStockTake: (data) => request('approve_stock_take.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    printStockTake: (id) => fetch(`${API_URL}/print_stock_take.php?id=${id}`, { credentials: 'include' }).then(res => res.text()),
    getStockTakeSession: (id) => request(`get_stock_take_session.php?id=${id}`),
    deleteStockTake: (id) => request('delete_stock_take.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    }),

};