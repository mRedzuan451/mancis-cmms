// js/app.js

import { state } from './config.js';
import { api } from './api.js';
import { handleLogin, handleLogout, handleRegistration, can } from './auth.js';
import { logActivity, showTemporaryMessage } from './utils.js';

// Import all UI rendering functions from ui.js
import {
    renderSidebar,
    renderDashboard,
    renderAssetsPage,
    renderPartsPage,
    renderWorkOrdersPage,
    renderUserManagementPage,
    renderWorkOrderCalendar,
    renderLocationsPage,
    renderActivityLogPage,
    renderPartsRequestPage,
    generateTableRows,
    showAssetModal,
    showPartModal,
    showWorkOrderModal,
    showEditUserModal,
    showCalendarDetailModal,
    // Add other modal functions if they need to be called from here
} from './ui.js';


// --- CORE APP RENDERING & ROUTING ---

/**
 * Renders the main content area based on the current page in the state.
 */
function renderMainContent() {
    const mainContent = document.getElementById("mainContent");
    let content = "";

    if (!can.viewPage(state.currentPage)) {
        state.currentPage = "dashboard";
    }

    switch (state.currentPage) {
        case "dashboard":       content = renderDashboard(); break;
        case "assets":          content = renderAssetsPage(); break;
        case "parts":           content = renderPartsPage(); break;
        case "workOrders":      content = renderWorkOrdersPage(); break;
        case "userManagement":  content = renderUserManagementPage(); break;
        case "workOrderCalendar": content = renderWorkOrderCalendar(); break;
        case "locations":       content = renderLocationsPage(); break;
        case "activityLog":     content = renderActivityLogPage(); break;
        case "partRequests":    content = renderPartsRequestPage(); break;
        default:                content = renderDashboard();
    }
    mainContent.innerHTML = content;
    attachPageSpecificEventListeners(state.currentPage);
}

/**
 * The main render function for the entire application.
 */
function render() {
    if (!state.currentUser) {
        document.getElementById("loginScreen").style.display = "flex";
        document.getElementById("app").style.display = "none";
    } else {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("app").style.display = "block";
        renderSidebar();
        renderMainContent();
    }
}

/**
 * Fetches all initial data from the API and stores it in the state cache.
 */
async function loadInitialData() {
    try {
        const [assets, parts, users, workOrders, partRequests, locations, logs, receivedParts] = await Promise.all([
            api.getAssets(), api.getParts(), api.getUsers(), api.getWorkOrders(),
            api.getPartRequests(), api.getLocations(), api.getLogs(), api.getReceivedParts(),
        ]);
        state.cache = { assets, parts, users, workOrders, partRequests, locations, logs, receivedParts };
    } catch (error) {
        showTemporaryMessage("Failed to load initial application data. Please try again.", true);
        handleLogout(render);
    }
}

/**
 * A wrapper function to load data and then render the application.
 */
async function loadAndRender() {
    await loadInitialData();
    render();
}


// --- ACTION HANDLERS (Forms, Deletes, etc.) ---

async function handleAssetFormSubmit(e) {
    e.preventDefault();
    const assetIdValue = document.getElementById("assetId").value;
    const isEditing = !!assetIdValue;
    const assetData = {
      name: document.getElementById("assetName").value,
      tag: document.getElementById("assetTag").value,
      category: document.getElementById("assetCategory").value,
      locationId: document.getElementById("assetLocation").value,
      purchaseDate: document.getElementById("assetPurchaseDate").value,
      cost: parseFloat(document.getElementById("assetCost").value),
      currency: document.getElementById("assetCurrency").value,
    };
    try {
      if (isEditing) {
        const assetId = parseInt(assetIdValue);
        await api.updateAsset(assetId, assetData);
        await logActivity("Asset Updated", `Updated asset: ${assetData.name} (ID: ${assetId})`);
      } else {
        await api.createAsset(assetData);
        await logActivity("Asset Created", `Created asset: ${assetData.name}`);
      }
      state.cache.assets = await api.getAssets();
      document.getElementById("assetModal").style.display = "none";
      renderMainContent();
      showTemporaryMessage('Asset saved successfully!');
    } catch(error) {
      showTemporaryMessage('Failed to save asset.', true);
    }
}

async function deleteAsset(assetId) {
    if (confirm("Are you sure you want to delete this asset? This may also delete associated work orders.")) {
      try {
          const assetToDelete = state.cache.assets.find(a => a.id === assetId);
          await api.deleteAsset(assetId);
          await logActivity("Asset Deleted", `Deleted asset: ${assetToDelete.name} (ID: ${assetId})`);
          state.cache.assets = await api.getAssets();
          state.cache.workOrders = await api.getWorkOrders();
          renderMainContent();
          showTemporaryMessage('Asset deleted successfully.');
      } catch (error) {
          showTemporaryMessage('Failed to delete asset.', true);
      }
    }
}

// ... Add all other action handlers here (handlePartFormSubmit, deletePart, etc.)
// These functions will call the `api` and then call `renderMainContent()` to refresh the view.


// --- EVENT LISTENER ATTACHMENT ---

/**
 * Attaches event listeners for elements that are specific to the currently rendered page.
 * @param {string} page The current page identifier.
 */
function attachPageSpecificEventListeners(page) {
    if (page === 'assets') {
        document.getElementById("addAssetBtn")?.addEventListener("click", () => showAssetModal());
        document.getElementById("assetSearch")?.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = state.cache.assets.filter(can.view).filter(a =>
                a.name.toLowerCase().includes(searchTerm) ||
                a.tag.toLowerCase().includes(searchTerm) ||
                a.category.toLowerCase().includes(searchTerm)
            );
            document.getElementById("assetTableBody").innerHTML = generateTableRows("assets", filtered);
        });
    }
    // Add event listeners for other pages following the same pattern
    // e.g., for 'parts', 'workOrders', etc.
}

/**
 * Attaches event listeners that are always active, regardless of the page.
 */
function attachGlobalEventListeners() {
    // Authentication
    document.getElementById("loginForm").addEventListener("submit", (e) => handleLogin(e, loadAndRender));
    document.getElementById("logoutBtn").addEventListener("click", () => handleLogout(render));
    document.getElementById("createAccountBtn").addEventListener("click", () => {
        document.getElementById("registrationModal").style.display = "flex";
    });
    document.getElementById("registrationForm").addEventListener("submit", (e) => handleRegistration(e, async () => {
        if (state.currentUser?.role === 'Admin') {
            state.cache.users = await api.getUsers();
            renderMainContent();
        }
    }));

    // Navigation
    document.getElementById("sidebar").addEventListener("click", (e) => {
      const navLink = e.target.closest(".nav-link");
      if (navLink) {
        e.preventDefault();
        state.currentPage = navLink.dataset.page;
        render();
      }
    });

    // Modal closing
    document.body.addEventListener("click", (e) => {
        if (e.target.closest("[data-close-modal]")) {
            const modal = e.target.closest(".modal");
            if (modal) modal.style.display = "none";
        }
    });

    // Main content clicks (delegated)
    document.getElementById("mainContent").addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        
        const id = parseInt(button.dataset.id);

        // Asset actions
        if (button.classList.contains("edit-asset-btn")) showAssetModal(id);
        if (button.classList.contains("delete-asset-btn")) deleteAsset(id);

        // Part actions
        if (button.classList.contains("edit-part-btn")) showPartModal(id);
        // if (button.classList.contains("delete-part-btn")) deletePart(id);

        // User actions
        if (button.classList.contains("edit-user-btn")) showEditUserModal(id);
        // if (button.classList.contains("delete-user-btn")) deleteUser(id);
        
        // Calendar actions
        const dayEl = e.target.closest(".calendar-day[data-date]");
        if (dayEl) {
          const date = dayEl.dataset.date;
          const workOrders = state.cache.workOrders.filter((wo) => wo.dueDate === date);
          showCalendarDetailModal(date, workOrders);
        }
    });

    // Form Submissions
    document.getElementById("assetForm")?.addEventListener("submit", handleAssetFormSubmit);
    // Add other form submission listeners here
}

// --- APPLICATION INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    attachGlobalEventListeners();
    render(); // Initial render for the login screen
});
