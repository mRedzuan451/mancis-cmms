// js/api.js
import { API_URL } from './config.js';
import { showTemporaryMessage } from './utils.js';

async function request(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error(`API request failed for ${endpoint}:`, error);
        if (error instanceof SyntaxError && error.message.includes("Unexpected token")) {
             showTemporaryMessage("A server error occurred. Please check the server logs.", true);
        } else {
             showTemporaryMessage(error.message, true);
        }
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
      login: (username, password) => api.request('login.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
      }),
      createUser: (data) => api.request('create_user.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updateUserRole: (data) => api.request('update_user_role.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deleteUser: (id) => api.request(`delete_user.php?id=${id}`, { method: 'POST' }),

      // LOG operations
      createLog: (data) => api.request('create_log.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),

      // ASSET operations
      createAsset: (data) => api.request('create_asset.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updateAsset: (id, data) => api.request(`update_asset.php?id=${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deleteAsset: (id) => api.request(`delete_asset.php?id=${id}`, { method: 'POST' }),

      // PARTS operations
      createPart: (data) => api.request('create_part.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updatePart: (id, data) => api.request(`update_part.php?id=${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deletePart: (id) => api.request(`delete_part.php?id=${id}`, { method: 'POST' }),

      // WORK ORDER operations
      createWorkOrder: (data) => api.request('create_work_order.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updateWorkOrder: (id, data) => api.request(`update_work_order.php?id=${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deleteWorkOrder: (id) => api.request(`delete_work_order.php?id=${id}`, { method: 'POST' }),

      // LOCATION operations
      createLocation: (data) => api.request('create_location.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deleteLocation: (data) => api.request('delete_location.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),

      // PART REQUEST WORKFLOW operations
      createPartRequest: (data) => api.request('create_part_request.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updatePartRequestStatus: (data) => api.request('update_part_request_status.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      receiveParts: (data) => api.request('receive_parts.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      restockParts: (data) => api.request('restock_parts.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
};