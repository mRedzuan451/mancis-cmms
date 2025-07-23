// js/auth.js

import { state } from './config.js';
import { api } from './api.js';
import { showTemporaryMessage, logActivity } from './utils.js';

/**
 * An object containing permission-checking functions.
 */
export const can = {
  /**
   * Checks if the current user can view a specific item based on their department.
   * @param {Object} item The item to check (e.g., asset, part, work order, part request).
   * @returns {boolean} True if the user has permission.
   */
  view: (item) => {
    if (!state.currentUser) return false;
    // Admins can see everything.
    if (state.currentUser.role === "Admin") return true;

    // --- NEW LOGIC: For items like Part Requests that are linked to a user ---
    if (item.requesterId) {
        // Find the user who made the request
        const requester = state.cache.users.find(u => u.id === item.requesterId);
        // If the requester is in the same department, allow viewing.
        if (requester && requester.departmentId === state.currentUser.departmentId) {
            return true;
        }
    }

    const {
      departments = [], subLines = [], productionLines = [],
      cabinets = [], shelves = [], boxes = [],
    } = state.cache.locations || {};
    
    let itemDepartmentId = null;

    // Case 1: The item itself has a departmentId (like a User)
    if (item.departmentId) {
      itemDepartmentId = item.departmentId;
    
    // Case 2: The item has a locationId (like an Asset or Part)
    } else if (item.locationId) {
      if (typeof item.locationId !== "string" || !item.locationId.includes("-")) return false;
      const [type, id] = item.locationId.split("-");
      const numId = parseInt(id);

      if (type === "pl") { // Production Line
        const pLine = productionLines.find((l) => l.id === numId);
        const subLine = pLine ? subLines.find((sl) => sl.id === pLine.subLineId) : null;
        if (subLine) itemDepartmentId = subLine.departmentId;
      } else if (type === "box") { // Storage Box
        const box = boxes.find((b) => b.id === numId);
        const shelf = box ? shelves.find((s) => s.id === box.shelfId) : null;
        const cabinet = shelf ? cabinets.find((c) => c.id === shelf.cabinetId) : null;
        if (cabinet) itemDepartmentId = cabinet.departmentId;
      }
    
    // Case 3: The item is linked to an asset (like a Work Order)
    } else if (item.assetId) {
      const asset = state.cache.assets.find((a) => a.id === parseInt(item.assetId));
      if (asset && asset.locationId) {
          // Recursively call this function to find the asset's department.
          return can.view(asset);
      }
    }
    
    if (itemDepartmentId === null) {
        return false;
    }

    return itemDepartmentId === state.currentUser.departmentId;
  },

  /**
   * Checks if the current user can view a specific page based on their role.
   * @param {string} page The page to check.
   * @returns {boolean} True if the user has permission.
   */
  viewPage: (page) => {
    if (!state.currentUser || !state.currentUser.permissions) return false;
    const { permissions } = state.currentUser;

    // The dashboard is always visible to logged-in users.
    if (page === "dashboard") {
      return true;
    }

    // Map pages to the specific permission required to view them.
    const pagePermissions = {
      assets: 'asset_view',
      parts: 'part_view',
      partRequests: 'part_request_view',
      stockTake: 'stock_take_create', // Users who can create can view the page
      workOrders: 'wo_view',
      pmSchedules: 'pm_schedule_view',
      workOrderCalendar: 'wo_view', // Calendar is based on work orders
      locations: 'location_management',
      inventoryReport: 'report_view',
      userManagement: 'user_view',
      activityLog: 'log_view',
      feedback: 'feedback_view', // This is the new rule
    };

    const requiredPermission = pagePermissions[page];

    // Return true only if the user's permissions object has the required key set to true.
    return requiredPermission ? permissions[requiredPermission] : false;
  },
};

// ... (rest of the file remains the same)

export async function handleLogin(e, onLoginSuccess) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const loginErrorEl = document.getElementById("loginError");
  
  try {
    loginErrorEl.textContent = ''; // Clear previous errors
    const user = await api.login(username, password);
    if (user && user.id) {
        state.currentUser = user;
        document.getElementById("loginForm").reset();
        await logActivity("User Login");
        onLoginSuccess(); // This will call loadAndRender() from app.js
    } else {
        loginErrorEl.textContent = "Invalid username or password.";
    }
  } catch (error) {
    loginErrorEl.textContent = error.message || "Login failed. Please try again.";
  }
}

export async function handleLogout(onLogoutSuccess) {
  await logActivity("User Logout");
  state.currentUser = null;
  state.currentPage = "dashboard";
  Object.keys(state.cache).forEach(key => {
      state.cache[key] = Array.isArray(state.cache[key]) ? [] : {};
  });
  onLogoutSuccess(); // This will call render() from app.js
}

export async function handleRegistration(e, onRegisterSuccess) {
    e.preventDefault();
    const regError = document.getElementById("regError");
    regError.textContent = '';

    const userData = {
        fullName: document.getElementById("regFullName").value,
        employeeId: document.getElementById("regEmployeeId").value,
        username: document.getElementById("regUsername").value,
        password: document.getElementById("regPassword").value,
        divisionId: parseInt(document.getElementById("regDivision").value),
        departmentId: parseInt(document.getElementById("regDepartment").value),
        role: "Clerk", // New users default to Clerk role
    };

    try {
        await api.createUser(userData);
        await logActivity("User Registered", `New user created: ${userData.fullName}`);
        
        document.getElementById("registrationModal").style.display = "none";
        document.getElementById("registrationForm").reset();
        showTemporaryMessage("Account created successfully! You can now log in.");
        
        if (state.currentUser && state.currentUser.role === 'Admin') {
            onRegisterSuccess();
        }

    } catch (error) {
        regError.textContent = error.message;
    }
}
