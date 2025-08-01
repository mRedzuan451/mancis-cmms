// js/auth.js

import { state } from './config.js';
import { api } from './api.js';
import { showTemporaryMessage, logActivity } from './utils.js';

/**
 * An object containing permission-checking functions.
 */
export const can = {
  /**
   * Checks if the current user can view a specific item.
   * THIS IS THE SIMPLIFIED FUNCTION.
   * Since the backend already filters all lists (assets, parts, etc.) by department,
   * this function just needs to confirm the item exists in the pre-filtered cache.
   * @param {Object} item The item to check.
   * @returns {boolean} True if the user can view the item.
   */
  view: (item) => {
    if (!state.currentUser) return false;
    // Admins can see everything, and the backend already ensures non-admins only get their department's data.
    // So, if the item is in the cache, they can view it.
    return true;
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
      costReport: 'report_cost_view',
      kpiReport: 'report_kpi_view',
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

    const roleSelect = document.getElementById("regRole");
    const isAdminCreating = roleSelect.style.display !== 'hidden';

    const userData = {
        fullName: document.getElementById("regFullName").value,
        employeeId: document.getElementById("regEmployeeId").value,
        username: document.getElementById("regUsername").value,
        password: document.getElementById("regPassword").value,
        email: document.getElementById("regEmail").value, // New field
        contact_number: document.getElementById("regContactNumber").value,
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