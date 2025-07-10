// js/api.js
import { API_URL } from './config.js';
// We no longer import showTemporaryMessage here

async function request(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, options);
        if (!response.ok) {
            // Get the error message from the server's JSON response
            const errorData = await response.json().catch(() => ({ message: 'An unknown server error occurred' }));
            // Throw an error with the message from the server
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        // If the response is OK, parse it and return it
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        // Log the error to the console for debugging
        console.error(`API request failed for ${endpoint}:`, error.message);
        // Re-throw the error so the calling function (in auth.js) can catch it and display the message
        throw error;
    }
}

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
};
