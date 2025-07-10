// js/auth.js

import { state } from './config.js';
import { api } from './api.js';
import { showTemporaryMessage } from './utils.js';

/**
 * Checks if the current user has permission to perform an action or view an item.
 * @param {string} action The action to check (e.g., 'view', 'viewPage').
 * @param {Object|string} item The item or page being checked.
 * @returns {boolean} True if the user has permission, false otherwise.
 */
export const can = {
  view: (item) => {
    if (!state.currentUser) return false;
    if (state.currentUser.role === "Admin") return true;

    const {
      divisions = [],
      departments = [],
      subLines = [],
      productionLines = [],
      cabinets = [],
      shelves = [],
      boxes = [],
    } = state.cache.locations || {};
    let itemDepartmentId;

    if (item.departmentId) {
      itemDepartmentId = item.departmentId;
    } else if (item.locationId) {
      if (
        typeof item.locationId !== "string" ||
        !item.locationId.includes("-")
      )
        return false;
      const [type, id] = item.locationId.split("-");
      const numId = parseInt(id);

      if (type === "pl") {
        const pLine = productionLines.find((l) => l.id === numId);
        if (pLine) {
          const subLine = subLines.find(
            (sl) => sl.id === pLine.subLineId
          );
          if (subLine) itemDepartmentId = subLine.departmentId;
        }
      } else if (type === "sl") {
        const subLine = subLines.find((sl) => sl.id === numId);
        if (subLine) itemDepartmentId = subLine.departmentId;
      } else if (type === "box") {
        const box = boxes.find((b) => b.id === numId);
        const shelf = box
          ? shelves.find((s) => s.id === box.shelfId)
          : null;
        const cabinet = shelf
          ? cabinets.find((c) => c.id === shelf.cabinetId)
          : null;
        if (cabinet) itemDepartmentId = cabinet.departmentId;
      } else if (type === "sh") {
        const shelf = shelves.find((s) => s.id === numId);
        const cabinet = shelf
          ? cabinets.find((c) => c.id === shelf.cabinetId)
          : null;
        if (cabinet) itemDepartmentId = cabinet.departmentId;
      } else if (type === "cab") {
        const cabinet = cabinets.find((c) => c.id === numId);
        if (cabinet) itemDepartmentId = cabinet.departmentId;
      }
    } else if (item.assetId) {
      const asset = state.cache.assets.find((a) => a.id === parseInt(item.assetId));
      if (
        asset &&
        asset.locationId &&
        typeof asset.locationId === "string" &&
        asset.locationId.includes("-")
      ) {
        const [type, id] = asset.locationId.split("-");
        const numId = parseInt(id);
        if (type === "pl") {
          const pLine = productionLines.find((l) => l.id === numId);
          if (pLine) {
            const subLine = subLines.find(
              (sl) => sl.id === pLine.subLineId
            );
            if (subLine) itemDepartmentId = subLine.departmentId;
          }
        }
      }
    }
    return itemDepartmentId === state.currentUser.departmentId;
  },
  viewPage: (page) => {
    if (!state.currentUser) return false;
    const adminOnlyPages = ["userManagement", "activityLog", "locations"];
    if (adminOnlyPages.includes(page)) {
      return state.currentUser.role === "Admin";
    }
    const nonClerkPages = [
      "assets",
      "parts",
      "workOrders",
      "workOrderCalendar",
    ];
    if (
      state.currentUser.role === "Clerk" &&
      nonClerkPages.includes(page)
    ) {
      return false;
    }
    return true;
  },
};

/**
 * Logs an activity to the database.
 * @param {string} action The action performed.
 * @param {string} details Additional details about the action.
 */
async function logActivity(action, details = "") {
    try {
        await api.createLog({
            user: state.currentUser ? state.currentUser.fullName : "System",
            action,
            details
        });
    } catch (error) {
        console.error("Failed to write log to database:", error);
    }
}

/**
 * Handles the login form submission.
 * @param {Event} e The form submission event.
 * @param {Function} onLoginSuccess A callback function to run after successful login.
 */
export async function handleLogin(e, onLoginSuccess) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  
  try {
    const user = await api.login(username, password);
    if (user && user.id) {
        state.currentUser = user;
        document.getElementById("loginError").textContent = "";
        document.getElementById("loginForm").reset();
        
        await logActivity("User Login");
        onLoginSuccess(); // This will call loadAndRender() from app.js
    } else {
        document.getElementById("loginError").textContent = "Invalid username or password.";
    }
  } catch (error) {
    document.getElementById("loginError").textContent = "Login failed. Please try again.";
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
        role: "Clerk",
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