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
    populateLocationDropdown,
    // --- IMPORT NEW MODAL FUNCTIONS ---
    showAssetDetailModal,
    showTransferAssetModal
} from './ui.js';


// --- CORE APP RENDERING & ROUTING ---

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

// --- NEW ACTION HANDLERS ---

async function handleDisposeAsset(assetId) {
    if (confirm("Are you sure you want to dispose of this asset? This will change its status to Decommissioned.")) {
        try {
            const asset = state.cache.assets.find(a => a.id === assetId);
            const updatedData = { ...asset, status: 'Decommissioned' };
            await api.updateAsset(assetId, updatedData);
            await logActivity("Asset Disposed", `Disposed asset: ${asset.name} (ID: ${assetId})`);
            state.cache.assets = await api.getAssets();
            renderMainContent();
            showTemporaryMessage('Asset has been decommissioned.');
        } catch (error) {
            showTemporaryMessage('Failed to dispose asset.', true);
        }
    }
}

async function handleTransferAssetFormSubmit(e) {
    e.preventDefault();
    const assetId = parseInt(document.getElementById('transferAssetId').value);
    const newLocationId = document.getElementById('transferLocation').value;
    const notes = document.getElementById('transferNotes').value;

    try {
        const asset = state.cache.assets.find(a => a.id === assetId);
        const updatedData = { ...asset, locationId: newLocationId };
        await api.updateAsset(assetId, updatedData);
        await logActivity("Asset Transferred", `Transferred ${asset.name} to new location. Notes: ${notes}`);
        state.cache.assets = await api.getAssets();
        document.getElementById('transferAssetModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage('Asset transferred successfully!');
    } catch (error) {
        showTemporaryMessage('Failed to transfer asset.', true);
    }
}


// --- EVENT LISTENER ATTACHMENT ---

function attachPageSpecificEventListeners(page) {
    if (page === 'assets') {
        document.getElementById("addAssetBtn")?.addEventListener("click", () => {
            showAssetModal();
            populateLocationDropdown(document.getElementById("assetLocation"), "operational");
        });
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
}

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
            e.target.closest(".modal").style.display = "none";
        }
    });

    // Main content clicks (delegated)
    document.getElementById("mainContent").addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        
        const id = parseInt(button.dataset.id);
        const asset = state.cache.assets.find(a => a.id === id);

        // --- UPDATE CLICK HANDLER LOGIC ---
        if (button.classList.contains("view-asset-btn")) showAssetDetailModal(asset);
        if (button.classList.contains("edit-asset-btn")) {
            showAssetModal(id);
            populateLocationDropdown(document.getElementById("assetLocation"), "operational");
        }
        if (button.classList.contains("delete-asset-btn")) deleteAsset(id);
        if (button.classList.contains("transfer-asset-btn")) {
            showTransferAssetModal(asset);
            populateLocationDropdown(document.getElementById("transferLocation"), "operational");
        }
        if (button.classList.contains("dispose-asset-btn")) handleDisposeAsset(id);

        // User actions
        if (button.classList.contains("edit-user-btn")) showEditUserModal(id);
    });

    // Form Submissions
    document.getElementById("assetForm").addEventListener("submit", handleAssetFormSubmit);
    document.getElementById("transferAssetForm").addEventListener("submit", handleTransferAssetFormSubmit);
}

// --- APPLICATION INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    attachGlobalEventListeners();
    render();
});
