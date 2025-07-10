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
   * @param {Object} item The item to check (e.g., asset, part, work order).
   * @returns {boolean} True if the user has permission.
   */
  view: (item) => {
    if (!state.currentUser) return false;
    if (state.currentUser.role === "Admin") return true;

    const {
      divisions = [], departments = [], subLines = [], productionLines = [],
      cabinets = [], shelves = [], boxes = [],
    } = state.cache.locations || {};
    let itemDepartmentId;

    if (item.departmentId) {
      itemDepartmentId = item.departmentId;
    } else if (item.locationId) {
      if (typeof item.locationId !== "string" || !item.locationId.includes("-")) return false;
      const [type, id] = item.locationId.split("-");
      const numId = parseInt(id);

      if (type === "pl") {
        const pLine = productionLines.find((l) => l.id === numId);
        if (pLine) {
          const subLine = subLines.find((sl) => sl.id === pLine.subLineId);
          if (subLine) itemDepartmentId = subLine.departmentId;
        }
      } else if (type === "box") {
        const box = boxes.find((b) => b.id === numId);
        const shelf = box ? shelves.find((s) => s.id === box.shelfId) : null;
        const cabinet = shelf ? cabinets.find((c) => c.id === shelf.cabinetId) : null;
        if (cabinet) itemDepartmentId = cabinet.departmentId;
      }
      // Add other location types ('sl', 'sh', 'cab') if needed
    } else if (item.assetId) {
      const asset = state.cache.assets.find((a) => a.id === parseInt(item.assetId));
      if (asset && asset.locationId && typeof asset.locationId === "string" && asset.locationId.includes("-")) {
        const [type, id] = asset.locationId.split("-");
        const numId = parseInt(id);
        if (type === "pl") {
          const pLine = productionLines.find((l) => l.id === numId);
          if (pLine) {
            const subLine = subLines.find((sl) => sl.id === pLine.subLineId);
            if (subLine) itemDepartmentId = subLine.departmentId;
          }
        }
      }
    }
    return itemDepartmentId === state.currentUser.departmentId;
  },

  /**
   * Checks if the current user can view a specific page based on their role.
   * @param {string} page The page to check.
   * @returns {boolean} True if the user has permission.
   */
  viewPage: (page) => {
    if (!state.currentUser) return false;
    const adminOnlyPages = ["userManagement", "activityLog", "locations"];
    if (adminOnlyPages.includes(page)) {
      return state.currentUser.role === "Admin";
    }
    const nonClerkPages = ["assets", "parts", "workOrders", "workOrderCalendar"];
    if (state.currentUser.role === "Clerk" && nonClerkPages.includes(page)) {
      return false;
    }
    return true;
  },
};

/**
 * Handles the login form submission.
 * @param {Event} e The form submission event.
 * @param {Function} onLoginSuccess A callback function to run after successful login.
 */
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
        // This case might not be reached if the API always throws an error for failures, but it's good for safety.
        loginErrorEl.textContent = "Invalid username or password.";
    }
  } catch (error) {
    // --- THIS IS THE KEY CHANGE ---
    // Display the specific error message thrown from api.js
    loginErrorEl.textContent = error.message || "Login failed. Please try again.";
  }
}

/**
 * Handles the logout process.
 * @param {Function} onLogoutSuccess A callback function to run after logout.
 */
export async function handleLogout(onLogoutSuccess) {
  await logActivity("User Logout");
  state.currentUser = null;
  state.currentPage = "dashboard";
  Object.keys(state.cache).forEach(key => {
      state.cache[key] = Array.isArray(state.cache[key]) ? [] : {};
  });
  onLogoutSuccess(); // This will call render() from app.js
}

/**
 * Handles the new user registration form submission.
 * @param {Event} e The form submission event.
 * @param {Function} onRegisterSuccess A callback to run on success.
 */
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
