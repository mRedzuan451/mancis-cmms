// js/app.js

import { state } from './config.js';
import { api } from './api.js';
import { handleLogin, handleLogout, handleRegistration, can } from './auth.js';
import { logActivity, showTemporaryMessage, printReport, getFullLocationName, calculateNextPmDate, getUserDepartment } from './utils.js';
// --- START: MODIFICATION ---
// Ensure the import list matches the corrected export list from ui.js
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
    renderPmSchedulesPage,
    renderInventoryReportPage,
    renderStockTakePage,
    renderStockTakeCountPage,
    renderTeamMessagesPage,
    generateTableRows,
    showAssetModal,
    showPartModal,
    showWorkOrderModal,
    showEditUserModal,
    showCalendarDetailModal,
    populateLocationDropdown,
    populateLocationDropdowns,
    showAssetDetailModal,
    showPartDetailModal,
    showWorkOrderDetailModal,
    showPartRequestDetailModal,
    showEditPartRequestModal,
    showTransferAssetModal,
    showCompleteWorkOrderModal,
    showPartRequestModal,
    showStorageRequestModal,
    showReceivePartsModal,
    showRestockPartsModal,
    showPmScheduleModal,
    showPmScheduleDetailModal,
    showMessageModal,
    showFeedbackToAdminModal,
    renderStatusChart,
    addChecklistItem,
    addPmPartRow,
    showUploadModal,
    renderCostReportPage,
    renderKpiReportPage,
    renderInventoryChart,
    renderCostChart,
    showNotificationModal,
} from './ui.js';


// --- CORE APP RENDERING & ROUTING ---

function renderMainContent() {
    const mainContent = document.getElementById("mainContent");
    let content = "";
    if (!can.viewPage(state.currentPage)) {
        state.currentPage = "dashboard";
    }
    switch (state.currentPage) {
        case "dashboard":           content = renderDashboard(); break;
        case "assets":              content = renderAssetsPage(); break;
        case "parts":               content = renderPartsPage(); break;
        case "workOrders":          content = renderWorkOrdersPage(); break;
        case "userManagement":      content = renderUserManagementPage(); break;
        case "workOrderCalendar":   content = renderWorkOrderCalendar(); break;
        case "locations":           content = renderLocationsPage(); break;
        case "inventoryReport":     content = renderInventoryReportPage(); break;
        case "costReport":          content = renderCostReportPage(); break;
        case "kpiReport":           content = renderKpiReportPage(); break;
        case "activityLog":         content = renderActivityLogPage(); break;
        case "partRequests":        content = renderPartsRequestPage(); break;
        case "pmSchedules":         content = renderPmSchedulesPage(); break;
        case "stockTake":           content = renderStockTakePage(); break;
        case "feedback":            content = renderTeamMessagesPage(); break;
        default:                    content = renderDashboard();
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
        const { permissions } = state.currentUser;
        
        const processPaginatedResponse = (module, response) => {
            state.cache[module] = response.data;
            state.pagination[module].currentPage = response.page;
            state.pagination[module].totalPages = Math.ceil(response.total / response.limit);
            state.pagination[module].totalRecords = response.total;
            state.pagination[module].limit = response.limit;
        };

        const dataPromises = [];

        // Paginated Data
        if (permissions.asset_view) dataPromises.push(api.getAssets(1).then(res => processPaginatedResponse('assets', res)));
        if (permissions.part_view) dataPromises.push(api.getParts(1).then(res => processPaginatedResponse('parts', res)));
        if (permissions.wo_view) dataPromises.push(api.getWorkOrders(1).then(res => processPaginatedResponse('workOrders', res)));
        if (permissions.part_request_view) dataPromises.push(api.getPartRequests(1).then(res => processPaginatedResponse('partRequests', res)));
        if (permissions.user_view) dataPromises.push(api.getUsers(1).then(res => processPaginatedResponse('users', res)));

        // --- NEW: Fetch all users and assets for lookups ---
        if (permissions.user_view) {
            dataPromises.push(api.getAllUsers().then(res => state.lookupCache.users = res.data));
        }
        if (permissions.asset_view) {
            dataPromises.push(api.getAllAssets().then(res => state.lookupCache.assets = res.data));
        }
        
        // Non-Paginated Data
        if (permissions.location_management) {
            dataPromises.push(api.getLocations().then(res => state.cache.locations = res));
        } else {
             dataPromises.push(api.getPublicLocations().then(res => state.cache.locations = res));
        }
        if (permissions.log_view) dataPromises.push(api.getLogs().then(res => state.cache.logs = res));
        if (permissions.pm_schedule_view) dataPromises.push(api.getPmSchedules().then(res => state.cache.pmSchedules = res));
        if (permissions.stock_take_create) dataPromises.push(api.getStockTakes().then(res => state.cache.stockTakes = res));
        if (permissions.feedback_view) dataPromises.push(api.getFeedback().then(res => state.cache.feedback = res));
        
        dataPromises.push(api.getReceivedParts().then(res => state.cache.receivedParts = res));
        dataPromises.push(api.getSystemSettings().then(res => state.settings = res));
        
        await Promise.all(dataPromises);

    } catch (error) {
        showTemporaryMessage("Failed to load application data. Please try again.", true);
        console.error("Error during initial data load:", error);
    }
}



async function loadAndRender() {
    await loadInitialData();
    
    try {
        await api.updateOverdueWorkOrders();
        const woResponse = await api.getWorkOrders(1); 
        
        state.cache.workOrders = woResponse.data;
        state.pagination.workOrders.currentPage = woResponse.page;
        state.pagination.workOrders.totalPages = Math.ceil(woResponse.total / woResponse.limit);
        state.pagination.workOrders.totalRecords = woResponse.total;
        state.pagination.workOrders.limit = woResponse.limit;

    } catch (error) {
        console.error("Failed to update or refetch overdue work orders:", error);
    }
    
    render();
    await checkForLowStockAndCreateRequests();
    await fetchAndDisplayNotifications();
}

async function handlePageChange(module, page) {
    try {
        let response;
        if (module === 'assets') {
            response = await api.getAssets(page);
        } else if (module === 'parts') {
            response = await api.getParts(page);
        } else if (module === 'workOrders') {
            response = await api.getWorkOrders(page);
        } else if (module === 'partRequests') {
            response = await api.getPartRequests(page);
        } else if (module === 'users') {
            response = await api.getUsers(page);
        }

        if (response) {
            state.cache[module] = response.data; // Essential: update the cache
            state.pagination[module].currentPage = response.page;
            state.pagination[module].totalPages = Math.ceil(response.total / response.limit);
            state.pagination[module].totalRecords = response.total;
            state.pagination[module].limit = response.limit;
        }

        renderMainContent();
    } catch (error) {
        showTemporaryMessage(`Failed to load page ${page} for ${module}.`, true);
    }
}

async function refreshAllDataAndRender() {
    if (!state.currentUser) {
        return;
    }
    // Check if any modal is currently displayed by looking for the 'flex' style.
    const isModalOpen = !!document.querySelector('.modal[style*="display: flex"]');
    if (isModalOpen) {
        console.log("Auto-refresh skipped: a modal is open.");
        return; // Abort the refresh if a modal is open to not interrupt the user.
    }

    console.log("Refreshing application data...");
    showTemporaryMessage("Refreshing data...");
    try {
        await loadInitialData(); // Reload all data from the backend
        renderMainContent(); // Re-render only the main content area with the new data
        console.log("Data refreshed successfully.");
    } catch (error) {
        showTemporaryMessage("Failed to refresh data.", true);
    }
}

// --- ACTION HANDLERS (Forms, Deletes, etc.) ---

async function checkForLowStockAndCreateRequests() {
    const lowStockParts = state.cache.parts.filter(p => parseInt(p.quantity) <= parseInt(p.minQuantity));
    if (lowStockParts.length === 0) return;

    const openRequestStatuses = ["Requested", "Approved", "Received", "Requested from Storage"];
    const partsWithOpenRequests = new Set(
        state.cache.partRequests
            .filter(req => openRequestStatuses.includes(req.status) && req.partId)
            .map(req => req.partId)
    );
    
    const partsToRequest = lowStockParts.filter(p => !partsWithOpenRequests.has(p.id));

    if (partsToRequest.length > 0) {
        showTemporaryMessage(`Found ${partsToRequest.length} low-stock item(s). Automatically creating requests...`);
        for (const part of partsToRequest) {
            try {
                const requestQty = (part.minQuantity > 0) ? (part.minQuantity * 2) : 10;
                await api.createAutoPartRequest({ partId: part.id, quantity: requestQty });
            } catch (error) {
                console.error(`Failed to create request for part ${part.name}:`, error);
            }
        }
        // --- START: MODIFICATION ---
        // This is the corrected block. It correctly handles the paginated response.
        const prResponse = await api.getPartRequests(1);
        state.cache.partRequests = prResponse.data;
        state.pagination.partRequests.currentPage = prResponse.page;
        state.pagination.partRequests.totalPages = Math.ceil(prResponse.total / prResponse.limit);
        state.pagination.partRequests.totalRecords = prResponse.total;
        // --- END: MODIFICATION ---
        if(state.currentPage === 'partRequests') renderMainContent();
    }
}

async function handleAssetFormSubmit(e) {
    e.preventDefault();
    const assetIdValue = document.getElementById("assetId").value;
    const isEditing = !!assetIdValue;

    // Get the current list of related parts from the form
    const newRelatedParts = Array.from(document.getElementById("assetRelatedParts").selectedOptions).map(opt => parseInt(opt.value));
    
    // Get the old list of related parts from the cache
    let oldRelatedParts = [];
    if (isEditing) {
        const existingAsset = state.cache.assets.find(a => a.id === parseInt(assetIdValue));
        oldRelatedParts = Array.isArray(existingAsset.relatedParts) ? existingAsset.relatedParts.map(id => parseInt(id)) : [];
    }

    const assetData = {
      name: document.getElementById("assetName").value,
      tag: document.getElementById("assetTag").value,
      category: document.getElementById("assetCategory").value,
      locationId: document.getElementById("assetLocation").value,
      purchaseDate: document.getElementById("assetPurchaseDate").value,
      cost: parseFloat(document.getElementById("assetCost").value),
      currency: document.getElementById("assetCurrency").value,
      relatedParts: newRelatedParts, // Use the numeric array
    };
    
    try {
      let assetId;

      if (isEditing) {
        assetId = parseInt(assetIdValue);
        await api.updateAsset(assetId, { ...assetData, relatedParts: JSON.stringify(newRelatedParts) });
        await logActivity("Asset Updated", `Updated asset: ${assetData.name} (ID: ${assetId})`);
      } else {
        const response = await api.createAsset({ ...assetData, relatedParts: JSON.stringify(newRelatedParts) });
        assetId = response.id;
        await logActivity("Asset Created", `Created asset: ${assetData.name}`);
      }
      
      const partsToAdd = newRelatedParts.filter(pId => !oldRelatedParts.includes(pId));
      const partsToRemove = oldRelatedParts.filter(pId => !newRelatedParts.includes(pId));

      const partUpdatePromises = [];
      
      // Update parts that were newly added to the asset
      partsToAdd.forEach(partId => {
          const part = state.cache.parts.find(p => p.id === partId);
          if (part) {
              const updatedRelatedAssets = Array.isArray(part.relatedAssets) ? [...part.relatedAssets, assetId.toString()] : [assetId.toString()];
              partUpdatePromises.push(api.updatePart(part.id, { ...part, relatedAssets: updatedRelatedAssets }));
          }
      });
      
      // Update parts that were removed from the asset
      partsToRemove.forEach(partId => {
          const part = state.cache.parts.find(p => p.id === partId);
          if (part) {
              const updatedRelatedAssets = (part.relatedAssets || []).filter(aId => aId !== assetId.toString());
              partUpdatePromises.push(api.updatePart(part.id, { ...part, relatedAssets: updatedRelatedAssets }));
          }
      });

      await Promise.all(partUpdatePromises);
      
      // Re-fetch all data to ensure cache is fully synchronized
      await loadInitialData();
      
      document.getElementById("assetModal").style.display = "none";
      renderMainContent();
      showTemporaryMessage('Asset saved and relationships updated successfully!');
    } catch(error) {
      showTemporaryMessage('Failed to save asset or update relationships.', true);
    }
}
// --- END: MODIFICATION ---

async function deleteItem(type, id) {
    const typeName = type.slice(0, -1);

    if (type === 'users') {
        if (id === 1) {
            showTemporaryMessage("Cannot delete the primary admin user.", true);
            return;
        }
        if (id === state.currentUser.id) {
            showTemporaryMessage("You cannot delete your own account.", true);
            return;
        }
    }

    if (!confirm(`Are you sure you want to delete this ${typeName}? This may affect related items.`)) {
        return;
    }

    try {
        let itemToDelete;
        const processPaginatedResponse = (module, response) => {
            state.cache[module] = response.data;
            state.pagination[module].currentPage = response.page;
            state.pagination[module].totalPages = Math.ceil(response.total / response.limit);
            state.pagination[module].totalRecords = response.total;
            state.pagination[module].limit = response.limit;
        };
        switch (type) {
            case 'assets':
                itemToDelete = state.cache.assets.find(i => i.id === id);
                await api.deleteAsset(id);
                await loadInitialData();
                break;
            case 'parts':
                itemToDelete = state.cache.parts.find(i => i.id === id);
                await api.deletePart(id);
                const currentPartsPage = state.pagination.parts.currentPage || 1;
                const partsResponse = await api.getParts(currentPartsPage);
                processPaginatedResponse('parts', partsResponse);
                break;
            case 'workOrders':
                itemToDelete = state.cache.workOrders.find(i => i.id === id);
                await api.deleteWorkOrder(id);
                const currentWoPage = state.pagination.workOrders.currentPage || 1;
                const woResponse = await api.getWorkOrders(currentWoPage);
                processPaginatedResponse('workOrders', woResponse);
                break;
            case 'users':
                itemToDelete = state.cache.users.find(i => i.id === id);
                await api.deleteUser(id);
                state.cache.users = await api.getUsers();
                break;
            default:
                throw new Error("Invalid item type for deletion.");
        }
        await logActivity(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} Deleted`, `Deleted ${typeName}: ${itemToDelete?.name || itemToDelete?.title || itemToDelete?.fullName} (ID: ${id})`);
        renderMainContent();
        showTemporaryMessage(`${typeName} deleted successfully.`);
    } catch (error) {
        showTemporaryMessage(`Failed to delete ${typeName}. ${error.message}`, true);
    }
}

async function handlePartFormSubmit(e) {
    e.preventDefault();
    const partIdValue = document.getElementById("partId").value;
    const isEditing = !!partIdValue;
    const partData = {
        name: document.getElementById("partName").value,
        sku: document.getElementById("partSku").value,
        category: document.getElementById("partCategory").value,
        quantity: parseInt(document.getElementById("partQuantity").value),
        minQuantity: parseInt(document.getElementById("partMinQuantity").value),
        locationId: document.getElementById("partLocation").value,
        maker: document.getElementById("partMaker").value,
        supplier: document.getElementById("partSupplier").value,
        price: parseFloat(document.getElementById("partPrice").value) || 0,
        currency: document.getElementById("partCurrency").value,
        relatedAssets: Array.from(document.getElementById("partRelatedAssets").selectedOptions).map(opt => opt.value),
        attachmentRef: document.getElementById("partAttachmentRef").value,
    };

    try {
        if (isEditing) {
            const partId = parseInt(partIdValue);
            await api.updatePart(partId, partData);
            await logActivity("Part Updated", `Updated part: ${partData.name} (ID: ${partId})`);
        } else {
            await api.createPart(partData);
            await logActivity("Part Created", `Created part: ${partData.name}`);
        }
        const currentPartsPage = state.pagination.parts.currentPage || 1;
        const response = await api.getParts(currentPartsPage);

        // Use the helper function to ensure all pagination data is updated
        const processPaginatedResponse = (module, response) => {
            state.cache[module] = response.data;
            state.pagination[module].currentPage = response.page;
            state.pagination[module].totalPages = Math.ceil(response.total / response.limit);
            state.pagination[module].totalRecords = response.total;
            state.pagination[module].limit = response.limit;
        };

        processPaginatedResponse('parts', response);

        document.getElementById("partModal").style.display = "none";
        renderMainContent();
        showTemporaryMessage('Part saved successfully!');
    } catch (error) {
        showTemporaryMessage(`Failed to save part. ${error.message}`, true);
    }
}

async function handleWorkOrderFormSubmit(e) {
    e.preventDefault();
    const woIdValue = document.getElementById("workOrderId").value;
    const isEditing = !!woIdValue;
    const startDate = document.getElementById("woStartDate").value;
    const dueDate = document.getElementById("woDueDate").value;

    if (new Date(startDate) > new Date(dueDate)) {
        showTemporaryMessage("Error: Start Date cannot be after the Due Date.", true);
        return; // Stop the function here
    }
    const checklistItems = Array.from(document.querySelectorAll("#woChecklistContainer .checklist-item span")).map(span => ({ text: span.textContent, completed: false }));
    const requiredParts = Array.from(document.querySelectorAll("#woPartsContainer .wo-part-row")).map(row => ({
        partId: parseInt(row.querySelector('.wo-part-select').value),
        quantity: parseInt(row.querySelector('.wo-part-qty').value)
    })).filter(p => p.partId && p.quantity > 0);

    const woData = {
        title: document.getElementById("woTitle").value,
        description: document.getElementById("woDescription").value,
        assetId: parseInt(document.getElementById("woAsset").value),
        assignedTo: parseInt(document.getElementById("woAssignedTo").value),
        task: document.getElementById("woTask").value,
        start_date: startDate, // Use the variable from validation
        dueDate: dueDate,
        breakdownTimestamp: document.getElementById("woBreakdownTime").value || null,
        priority: document.getElementById("woPriority").value,
        frequency: document.getElementById("woFrequency").value,
        status: document.getElementById("woStatus").value,
        frequency: "One-Time",
        checklist: checklistItems,
        requiredParts: requiredParts,
        wo_type: 'CM' 
    };

    try {
        if (isEditing) {
            const woId = parseInt(woIdValue);
            await api.updateWorkOrder(woId, woData);
            await logActivity("Work Order Updated", `Updated WO: ${woData.title} (ID: ${woId})`);
        } else {
            await api.createWorkOrder(woData);
            await logActivity("Work Order Created", `Created WO: ${woData.title}`);
        }
        const woResponse = await api.getWorkOrders(1);
        state.cache.workOrders = woResponse.data;
        state.pagination.workOrders.currentPage = woResponse.page;
        state.pagination.workOrders.totalPages = Math.ceil(woResponse.total / woResponse.limit);
        state.pagination.workOrders.totalRecords = woResponse.total;
        document.getElementById("workOrderModal").style.display = "none";
        renderMainContent();
        showTemporaryMessage('Work Order saved successfully!');
    } catch (error) {
        showTemporaryMessage(`Failed to save Work Order. ${error.message}`, true);
    }
}

async function handleEditUserFormSubmit(e) {
    e.preventDefault();
    const userId = parseInt(document.getElementById('editUserId').value);
    const newRole = document.getElementById('editUserRole').value;

    const permissions = {};
    document.querySelectorAll('#userPermissionsContainer input[type="checkbox"]').forEach(checkbox => {
        permissions[checkbox.dataset.key] = checkbox.checked;
    });

    try {
        // --- THIS IS THE FIX ---
        // We now send the role and permissions together in a single API call.
        await api.updateUserPermissions({ 
            userId, 
            role: newRole, 
            permissions 
        });

        await logActivity("User Permissions Updated", `Updated roles and permissions for user ID ${userId}`);
        
        // Refresh data and UI
        state.cache.users = await api.getUsers();
        document.getElementById('editUserModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("User role and permissions updated successfully!");

    } catch (error) {
        showTemporaryMessage(`Failed to update user. ${error.message}`, true);
    }
}

async function handleDisposeAsset(assetId) {
    if (confirm("Are you sure you want to dispose of this asset? This will change its status to Decommissioned.")) {
        try {
            const asset = state.cache.assets.find(a => Number(a.id) === assetId);
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

async function handleCompleteWorkOrderFormSubmit(e) {
    e.preventDefault();
    const woId = parseInt(document.getElementById('completeWorkOrderId').value);
    const wo = state.cache.workOrders.find(w => w.id === woId);
    if (!wo) return;

    const updatedData = {
        ...wo,
        status: 'Completed',
        completionNotes: document.getElementById('completionNotes').value,
        completedDate: new Date().toISOString().split('T')[0]
    };

    try {
        await api.updateWorkOrder(woId, updatedData);
        await logActivity("Work Order Completed", `Completed WO: ${wo.title} (ID: ${woId})`);
        const woResponse = await api.getWorkOrders(1);
        state.cache.workOrders = woResponse.data;
        state.pagination.workOrders.currentPage = woResponse.page;
        state.pagination.workOrders.totalPages = Math.ceil(woResponse.total / woResponse.limit);
        state.pagination.workOrders.totalRecords = woResponse.total;
        document.getElementById('completeWorkOrderModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("Work Order marked as complete!");

    } catch (error) {
        console.error("Completion Error:", error); // Log the full error for debugging

        if (error.message.includes("INSUFFICIENT_STOCK")) {
            // Case 1: Specific "Not Enough Stock" error from our backend
            const friendlyMessage = error.message.replace('INSUFFICIENT_STOCK:', '').trim();
            showTemporaryMessage(friendlyMessage, true);

        } else if (error.message.includes("Failed to fetch")) {
            // Case 2: Network error (e.g., server is down, no internet)
            showTemporaryMessage("Network Error: Could not connect to the server. Please check your connection.", true);

        } else if (error.message.includes("HTTP error")) {
            // Case 3: Other server-side error (e.g., 500 Internal Server Error, 404 Not Found)
            showTemporaryMessage("Server Error: The server responded with an error. Please try again later.", true);

        } else {
            // Case 4: A generic fallback for any other unexpected errors
            showTemporaryMessage(`An unexpected error occurred: ${error.message}`, true);
        }
    }
}

async function handlePartRequestFormSubmit(e) {
    e.preventDefault();
    const requestId = document.getElementById('partRequestId').value;
    const isEditing = !!requestId;

    // --- START: MODIFICATION ---
    const assetId = document.getElementById('requestAssetId').value;
    const purposeText = document.getElementById('requestPurpose').value;
    let finalPurpose = purposeText;

    // Only add asset info on creation, not when editing an existing request.
    if (assetId && !isEditing) {
        const asset = state.cache.assets.find(a => a.id === parseInt(assetId));
        if (asset) {
            // Prepend the asset information to the purpose
            finalPurpose = `For asset "${asset.name}": ${purposeText}`;
        }
    }
    // --- END: MODIFICATION ---

    try {
        if (isEditing) {
            const requestData = {
                partId: parseInt(document.getElementById('requestPartId').value),
                quantity: parseInt(document.getElementById('requestQuantity').value),
                purpose: document.getElementById('requestPurpose').value,
            };
            await api.updatePartRequest(requestId, requestData);
            await logActivity("Part Request Updated", `Updated request ID: ${requestId}`);
        } else {
            const isNewPart = document.getElementById('requestNewPartCheckbox').checked;
            let requestData = {
                partId: isNewPart ? null : parseInt(document.getElementById('requestPartId').value),
                quantity: parseInt(document.getElementById('requestQuantity').value),
                purpose: finalPurpose, // Use the modified purpose string
                requesterId: state.currentUser.id,
                requestDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
                status: 'Requested',
                notes: '',
                newPartName: isNewPart ? document.getElementById('newPartName').value : null,
                newPartNumber: isNewPart ? document.getElementById('newPartNumber').value : null,
                newPartMaker: isNewPart ? document.getElementById('newPartMaker').value : null,
            };
            await api.createPartRequest(requestData);
            await logActivity("Part Request Submitted", `User requested ${requestData.quantity} x ${isNewPart ? requestData.newPartName : 'existing part'}`);
        }
        
        // Correctly handle the paginated response
        const prResponse = await api.getPartRequests(1);
        state.cache.partRequests = prResponse.data;
        state.pagination.partRequests.currentPage = prResponse.page;
        
        document.getElementById('partRequestModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage(`Part request ${isEditing ? 'updated' : 'submitted'} successfully!`);

    } catch (error) {
        showTemporaryMessage(`Failed to save request. ${error.message}`, true);
    }
}

async function handleStorageRequestFormSubmit(e) {
    e.preventDefault();
    const assetId = document.getElementById('storageRequestAssetId').value;
    const purposeText = document.getElementById('storageRequestPurpose').value;
    let finalPurpose = purposeText;

    if (assetId) {
        const asset = state.cache.assets.find(a => a.id === parseInt(assetId));
        if (asset) {
            // Prepend the asset information to the purpose
            finalPurpose = `For asset "${asset.name}": ${purposeText}`;
        }
    }
    let requestData = {
        partId: parseInt(document.getElementById('storageRequestPartId').value),
        quantity: parseInt(document.getElementById('storageRequestQuantity').value),
        purpose: finalPurpose, // Use the modified purpose string
        requesterId: state.currentUser.id,
        requestDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
        status: 'Requested from Storage',
    };
     try {
        await api.createPartRequest(requestData);
        await logActivity("Storage Request Submitted", `User requested ${requestData.quantity} x part ID ${requestData.partId} from storage`);
        
        // --- START: MODIFICATION ---
        const prResponse = await api.getPartRequests(1);
        state.cache.partRequests = prResponse.data;
        state.pagination.partRequests.currentPage = prResponse.page;
        // --- END: MODIFICATION ---

        document.getElementById('storageRequestModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("Request from storage submitted successfully!");
    } catch (error) {
        showTemporaryMessage(`Failed to submit request. ${error.message}`, true);
    }
}

async function handlePartRequestAction(id, newStatus) {
    let rejectionReason = null;
    if (newStatus === 'Rejected') {
        rejectionReason = prompt("Please provide a reason for rejecting this request:");
        if (rejectionReason === null) return;
    }
    if (!confirm(`Are you sure you want to ${newStatus.toLowerCase()} this request?`)) return;
    
    try {
        await api.updatePartRequestStatus({ id, status: newStatus, approverId: state.currentUser.id, rejectionReason });
        await logActivity(`Part Request ${newStatus}`, `Request ID ${id} was marked as ${newStatus}`);
        
        // --- START: MODIFICATION ---
        const prResponse = await api.getPartRequests(1);
        state.cache.partRequests = prResponse.data;
        // --- END: MODIFICATION ---

        if (newStatus === 'Approved') {
            const partsResponse = await api.getParts(1);
            state.cache.parts = partsResponse.data;
        }
        renderMainContent();
        showTemporaryMessage(`Request ${newStatus.toLowerCase()} successfully.`);
    } catch (error) {
        showTemporaryMessage(`Failed to update request. ${error.message}`, true);
    }
}

async function handleReceivePartsFormSubmit(e) {
    e.preventDefault();
    const requestId = parseInt(document.getElementById('receiveRequestId').value);
    try {
        await api.receiveParts({ requestId, receiverId: state.currentUser.id });
        await logActivity("Parts Received", `Marked approved request ID ${requestId} as received.`);

        // --- START: MODIFICATION ---
        const prResponse = await api.getPartRequests(1);
        state.cache.partRequests = prResponse.data;
        // --- END: MODIFICATION ---

        state.cache.receivedParts = await api.getReceivedParts();
        document.getElementById('receivePartsModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("Parts marked as received.");
    } catch (error) {
        showTemporaryMessage(`Failed to receive parts. ${error.message}`, true);
    }
}

// js/app.js

async function handleRestockPartsFormSubmit(e) {
    e.preventDefault();
    const isDirectStockMode = document.getElementById('directStockContainer').style.display === 'block';
    
    try {
        let payload = {};
        let logMessage = "";
        
        if (isDirectStockMode) {
            const isNewPart = document.getElementById('isNewPartCheckbox').checked;
            payload = {
                quantity: parseInt(document.getElementById('directStockQuantity').value),
                locationId: document.getElementById('restockLocationId').value,
                notes: document.getElementById('directStockNotes').value
            };
            if (isNewPart) {
                payload.newPartName = document.getElementById('newPartName').value;
                payload.newPartSku = document.getElementById('newPartSku').value;
                payload.newPartMaker = document.getElementById('newPartMaker').value;
                payload.newPartCategory = document.getElementById('newPartCategory').value;
                logMessage = `Direct restock (new part): ${payload.quantity} x ${payload.newPartName}`;
            } else {
                const receivedId = parseInt(document.getElementById('restockPartId').value);
                const locationId = document.getElementById('restockLocationId').value;
                await api.restockParts({ receivedId, locationId });
                logMessage = `Restocked parts from received request ID: ${receivedId}`;
            }
            await api.directRestockPart(payload);
        } else {
            const receivedId = parseInt(document.getElementById('restockPartId').value);
            const locationId = document.getElementById('restockLocationId').value;
            await api.restockParts({ receivedId, locationId });
            logMessage = `Restocked parts from received request ID: ${receivedId}`;
        }
        
        const processPaginatedResponse = (module, response) => {
            state.cache[module] = response.data;
            state.pagination[module].currentPage = response.page;
            state.pagination[module].totalPages = Math.ceil(response.total / response.limit);
            state.pagination[module].totalRecords = response.total;
            state.pagination[module].limit = response.limit;
        };

        const currentPartsPage = state.pagination.parts.currentPage || 1;
        const currentRequestsPage = state.pagination.partRequests.currentPage || 1;

        state.cache.receivedParts = await api.getReceivedParts();
        
        const prResponse = await api.getPartRequests(currentRequestsPage);
        processPaginatedResponse('partRequests', prResponse);
        
        const partsResponse = await api.getParts(currentPartsPage);
        processPaginatedResponse('parts', partsResponse);

        if (state.currentUser.permissions.log_view) {
            state.cache.logs = await api.getLogs();
        }
        
        document.getElementById('restockPartsModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("Parts restocked successfully.");

    } catch (error) {
        showTemporaryMessage(`Failed to restock parts. ${error.message}`, true);
    }
}

async function handleLocationFormSubmit(e) {
    e.preventDefault(); // Prevent default form submission
    const form = e.target;
    const isAdmin = state.currentUser.role === 'Admin';
    let type, name, parentId;

    const formId = form.id;
    switch(formId) {
        case 'addDivisionForm':
            type = 'division';
            name = form.querySelector('input').value;
            break;
        case 'addDepartmentForm':
            type = 'department';
            name = form.querySelector('input').value;
            parentId = form.querySelector('select').value;
            break;
        case 'addSubLineForm':
            type = 'subLine';
            name = form.querySelector('input').value;
            parentId = form.querySelector('select').value;
            break;
        case 'addProductionLineForm':
            type = 'productionLine';
            name = form.querySelector('input').value;
            parentId = form.querySelector('select').value;
            break;
        case 'addCabinetForm':
            type = 'cabinet';
            name = form.querySelector('input').value;
            parentId = isAdmin ? form.querySelector('select').value : state.currentUser.departmentId;
            break;
        case 'addShelfForm':
            type = 'shelf';
            name = form.querySelector('input').value;
            parentId = form.querySelector('select').value;
            break;
        case 'addBoxForm':
            type = 'box';
            name = form.querySelector('input').value;
            parentId = form.querySelector('select').value;
            break;
        default:
            showTemporaryMessage('Unknown form submission.', true);
            return;
    }

    try {
        await api.createLocation({ type, name, parentId });
        await logActivity("Location Created", `Created new ${type}: ${name}`);
        state.cache.locations = await api.getLocations();
        renderMainContent();
        showTemporaryMessage(`${type} created successfully.`);
    } catch (error) {
        showTemporaryMessage(`Failed to create ${type}. ${error.message}`, true);
    }
}


async function deleteLocation(type, id) {
    if (!confirm(`Are you sure you want to delete this ${type}? This can affect assets, parts, and other locations.`)) return;
    try {
        await api.deleteLocation({ type, id });
        await logActivity("Location Deleted", `Deleted ${type} with ID ${id}`);
        state.cache.locations = await api.getLocations();
        renderMainContent();
        showTemporaryMessage(`${type} deleted successfully.`);
    } catch (error) {
        showTemporaryMessage(`Failed to delete ${type}. ${error.message}`, true);
    }
}

async function handlePmScheduleFormSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById("pmTitle").value;
    const startDate = document.getElementById("pmStartDate").value;
    const assetId = document.getElementById("pmAsset").value;
    const assignedTo = document.getElementById("pmAssignedTo").value;
    const task = document.getElementById("pmTask").value;

    if (!title || !startDate || !assetId || !assignedTo || !task) {
        alert("Please fill out all required fields: Title, Start Date, Asset, Assign To, and Task.");
        return; 
    }

    const scheduleId = document.getElementById("pmScheduleId").value;
    const isEditing = !!scheduleId;

    // --- START: NEW DATA GATHERING LOGIC ---
    const checklistItems = Array.from(document.querySelectorAll("#pmChecklistContainer .checklist-item span")).map(span => ({ text: span.textContent, completed: false }));
    const requiredParts = Array.from(document.querySelectorAll("#pmPartsContainer .pm-part-row")).map(row => ({
        partId: parseInt(row.querySelector('.pm-part-select').value),
        quantity: parseInt(row.querySelector('.pm-part-qty').value)
    })).filter(p => p.partId && p.quantity > 0);
    // --- END: NEW DATA GATHERING LOGIC ---

    const scheduleData = {
        title: title,
        schedule_start_date: startDate,
        assetId: parseInt(assetId),
        task: task,
        description: document.getElementById("pmDescription").value,
        frequency_interval: parseInt(document.getElementById("pmFrequencyInterval").value),
        frequency_unit: document.getElementById("pmFrequencyUnit").value,
        due_date_buffer: document.getElementById("pmDueDateBuffer").value ? parseInt(document.getElementById("pmDueDateBuffer").value) : null,
        assignedTo: parseInt(assignedTo),
        is_active: document.getElementById('pmIsActive').checked ? 1 : 0,
        checklist: checklistItems, // Add new data to payload
        requiredParts: requiredParts // Add new data to payload
    };

    try {
        if (isEditing) {
            await api.updatePmSchedule(parseInt(scheduleId), scheduleData);
            await logActivity("PM Schedule Updated", `Updated: ${scheduleData.title}`);
        } else {
            await api.createPmSchedule(scheduleData);
            await logActivity("PM Schedule Created", `Created: ${scheduleData.title}`);
        }

        state.cache.pmSchedules = await api.getPmSchedules();
        document.getElementById("pmScheduleModal").style.display = "none";
        renderMainContent();
        showTemporaryMessage('PM Schedule saved successfully!');
    } catch (error) {
        showTemporaryMessage(`Failed to save schedule. ${error.message}`, true);
    }
}

async function handleMassDelete(type) {
    const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    const idsToDelete = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.id));

    if (idsToDelete.length === 0) {
        showTemporaryMessage("No items selected for deletion.", true);
        return;
    }

    if (!confirm(`Are you sure you want to delete ${idsToDelete.length} selected item(s)? This action cannot be undone.`)) {
        return;
    }

    showTemporaryMessage(`Deleting ${idsToDelete.length} item(s)...`);

    try {
        const deletePromises = idsToDelete.map(id => {
            switch (type) {
                case 'assets': return api.deleteAsset(id);
                case 'parts': return api.deletePart(id);
                // Add other types here as you implement them
                default: return Promise.reject(new Error("Invalid type for mass delete."));
            }
        });

        await Promise.all(deletePromises);

        await logActivity(`Mass Delete Executed`, `Deleted ${idsToDelete.length} item(s) of type: ${type}`);
        
        // Refresh data after deletion
        await refreshAllDataAndRender();
        showTemporaryMessage(`${idsToDelete.length} item(s) deleted successfully.`);
        
    } catch (error) {
        showTemporaryMessage(`An error occurred during mass deletion. ${error.message}`, true);
    }
}


// --- EVENT LISTENER ATTACHMENT ---

function attachPageSpecificEventListeners(page) {
    // This helper function sets up the checkbox and "Delete Selected" button logic for a given page
    const setupCheckboxLogic = (pageType) => {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        const rowCheckboxes = document.querySelectorAll('.row-checkbox');
        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

        const toggleDeleteButton = () => {
            const anyChecked = document.querySelector('.row-checkbox:checked');
            deleteSelectedBtn?.classList.toggle('hidden', !anyChecked);
        };

        selectAllCheckbox?.addEventListener('change', (e) => {
            rowCheckboxes.forEach(checkbox => checkbox.checked = e.target.checked);
            toggleDeleteButton();
        });

        rowCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (!checkbox.checked) selectAllCheckbox.checked = false;
                toggleDeleteButton();
            });
        });
        
        deleteSelectedBtn?.addEventListener('click', () => handleMassDelete(pageType));
    };

    if (page === 'dashboard') {
        const workOrders = state.cache.workOrders.filter(can.view);
        const statusCounts = workOrders.reduce((acc, wo) => {
            acc[wo.status] = (acc[wo.status] || 0) + 1;
            return acc;
        }, {});
        renderStatusChart(statusCounts);
    }

    // Apply the checkbox logic to all pages that have a table list
    if (['assets', 'parts', 'workOrders', 'userManagement'].includes(page)) {
        const itemType = page === 'userManagement' ? 'users' : page;
        setupCheckboxLogic(itemType);
    }
    
    // Attach any other event listeners that are specific to a certain page
    if (page === 'assets') {
        document.getElementById("uploadAssetsBtn")?.addEventListener("click", () => {
            showUploadModal('assets');
            document.getElementById('assetUploadInput').click();
        });
        document.getElementById("assetUploadInput")?.addEventListener("change", (e) => {
            handleFileUpload(e.target.files[0], 'assets');
        });
        document.getElementById("addAssetBtn")?.addEventListener("click", () => showAssetModal());
        document.getElementById("assetSearch")?.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = state.cache.assets.filter(can.view).filter(a =>
                a.name.toLowerCase().includes(searchTerm) ||
                a.tag.toLowerCase().includes(searchTerm) ||
                a.category.toLowerCase().includes(searchTerm) ||
                getFullLocationName(a.locationId).toLowerCase().includes(searchTerm)
            );
            document.getElementById("assetTableBody").innerHTML = generateTableRows("assets", filtered);
        });
        
        // --- Print Logic for Assets ---
        document.getElementById("printAssetListBtn")?.addEventListener("click", () => {
            const assetsToPrint = state.cache.assets.filter(can.view);
            const title = "Asset List Report";
            let content = `<h1>${title}</h1><p>Generated on: ${new Date().toLocaleString()}</p>`;
            content += `
                <table border="1" style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 5px; text-align: left;">Name</th>
                            <th style="padding: 5px; text-align: left;">Tag</th>
                            <th style="padding: 5px; text-align: left;">Location</th>
                            <th style="padding: 5px; text-align: left;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${assetsToPrint.map(asset => `
                            <tr>
                                <td style="padding: 5px;">${asset.name}</td>
                                <td style="padding: 5px;">${asset.tag}</td>
                                <td style="padding: 5px;">${getFullLocationName(asset.locationId)}</td>
                                <td style="padding: 5px;">${asset.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
            printReport(title, content);
        });

    } else if (page === 'parts') {
        document.getElementById("uploadPartsBtn")?.addEventListener("click", () => {
            showUploadModal('parts');
            document.getElementById('partUploadInput').click();
        });
        document.getElementById("partUploadInput")?.addEventListener("change", (e) => {
            handleFileUpload(e.target.files[0], 'parts');
        });
        document.getElementById("addPartBtn")?.addEventListener("click", () => showPartModal());
        
        // --- Search Logic for Parts ---
        document.getElementById("partSearch")?.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = state.cache.parts.filter(can.view).filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.sku.toLowerCase().includes(searchTerm) ||
                p.category.toLowerCase().includes(searchTerm)
            );
            document.getElementById("partTableBody").innerHTML = generateTableRows("parts", filtered);
        });

        // --- Print Logic for Parts ---
        document.getElementById("printPartListBtn")?.addEventListener("click", () => {
            const partsToPrint = state.cache.parts.filter(can.view);
            const title = "Spare Part Inventory Report";
            let content = `<h1>${title}</h1><p>Generated on: ${new Date().toLocaleString()}</p>`;
            content += `
                <table border="1" style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 5px; text-align: left;">Part Name</th>
                            <th style="padding: 5px; text-align: left;">SKU</th>
                            <th style="padding: 5px; text-align: right;">Quantity</th>
                            <th style="padding: 5px; text-align: left;">Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${partsToPrint.map(part => `
                            <tr>
                                <td style="padding: 5px;">${part.name}</td>
                                <td style="padding: 5px;">${part.sku}</td>
                                <td style="padding: 5px; text-align: right;">${part.quantity}</td>
                                <td style="padding: 5px;">${getFullLocationName(part.locationId)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
            printReport(title, content);
        });

    } else if (page === 'workOrders') {
        document.getElementById("addWorkOrderBtn")?.addEventListener("click", showWorkOrderModal);
        document.querySelectorAll('.wo-type-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const selectedType = e.target.dataset.type;
                document.querySelectorAll('.wo-type-tab').forEach(t => t.classList.remove('text-blue-600', 'border-blue-500'));
                e.target.classList.add('text-blue-600', 'border-blue-500');
                const allWorkOrders = state.cache.workOrders.filter(can.view);
                const filteredWOs = selectedType === 'All' 
                    ? allWorkOrders
                    // Corrected to include wo_type in search logic as well.
                    : allWorkOrders.filter(wo => wo.wo_type === selectedType);
                document.getElementById('workOrderTableBody').innerHTML = generateTableRows("workOrders", filteredWOs);
            });
        });
    } else if (page === 'workOrderCalendar') {
        document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
            state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
            renderMainContent();
        });
        document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
            state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
            renderMainContent();
        });
    } else if (page === 'partRequests') {
        document.getElementById('newPartRequestBtn')?.addEventListener('click', showPartRequestModal);
        
        document.getElementById('storageRequestBtn')?.addEventListener('click', async () => {
            try {
                showTemporaryMessage("Loading latest part quantities...");
                state.cache.parts = await api.getParts();
                showStorageRequestModal();
            } catch (error) {
                showTemporaryMessage("Could not load latest parts list.", true);
            }
        });

        document.getElementById('receivePartsBtn')?.addEventListener('click', showReceivePartsModal);
        document.getElementById('restockPartsBtn')?.addEventListener('click', showRestockPartsModal);
        
        document.getElementById("partRequestSearch")?.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = state.cache.partRequests.filter(req => {
                const part = req.partId ? state.cache.parts.find(p => p.id === req.partId) : null;
                const requester = state.cache.users.find(u => u.id === req.requesterId);

                const partName = part ? part.name : (req.newPartName || '');
                const partNumber = part ? part.sku : (req.newPartNumber || '');
                const requesterName = requester ? requester.fullName : '';

                return partName.toLowerCase().includes(searchTerm) ||
                       partNumber.toLowerCase().includes(searchTerm) ||
                       requesterName.toLowerCase().includes(searchTerm);
            });
            
            // Note the new ID for the table body
            document.getElementById("partRequestTableBody").innerHTML = generateTableRows("partRequests", filtered);
        });
        // --- END: ADDED SEARCH LOGIC ---

        document.getElementById('printPurchaseListBtn')?.addEventListener('click', () => {
            const requestsToPrint = state.cache.partRequests.filter(req => req.status === 'Approved');

            if (requestsToPrint.length === 0) {
                showTemporaryMessage("There are no approved part requests to print.", true);
                return;
            }

            const groupedByDept = requestsToPrint.reduce((acc, req) => {
                // Use the department name provided directly by the API.
                const departmentName = req.departmentName || 'Unassigned';
                
                if (!acc[departmentName]) {
                    acc[departmentName] = [];
                }
                acc[departmentName].push(req);
                return acc;
            }, {});

            const title = "Part Purchase List";
            let content = `<h1>${title}</h1>`;

            for (const department in groupedByDept) {
                content += `<h2 style="margin-top: 20px; background-color: #f2f2f2; padding: 10px; border-bottom: 1px solid #ddd;">Department: ${department}</h2>`;
                content += `
                    <table border="1" style="width:100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="padding: 5px; text-align: left;">Part Name</th>
                                <th style="padding: 5px; text-align: left;">Part Number / SKU</th>
                                <th style="padding: 5px; text-align: right;">Quantity</th>
                                <th style="padding: 5px; text-align: left;">Maker</th>
                                <th style="padding: 5px; text-align: left;">Requester</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                groupedByDept[department].forEach(req => {
                    const part = req.partId ? state.cache.parts.find(p => p.id === req.partId) : null;
                    // Use the requester name provided directly by the API.
                    const requesterName = req.requesterName || 'N/A';

                    const partName = part ? part.name : (req.newPartName || 'N/A');
                    const partNumber = part ? part.sku : (req.newPartNumber || 'N/A');
                    const maker = part ? part.maker : (req.newPartMaker || '');
                    
                    content += `
                        <tr>
                            <td style="padding: 5px;">${partName}</td>
                            <td style="padding: 5px;">${partNumber}</td>
                            <td style="padding: 5px; text-align: right;">${req.quantity}</td>
                            <td style="padding: 5px;">${maker}</td>
                            <td style="padding: 5px;">${requesterName}</td>
                        </tr>
                    `;
                });

                content += `</tbody></table>`;
            }
            // --- END: MODIFICATION ---

            printReport(title, content);
        });
    } else if (page === 'pmSchedules') {
        document.getElementById('addPmScheduleBtn')?.addEventListener('click', () => showPmScheduleModal());
        document.getElementById('generatePmWoBtn')?.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to generate new PM work orders?")) return;
            showTemporaryMessage("Generating PM work orders, please wait...");
            try {
                const result = await api.generatePmWorkOrders();
                showTemporaryMessage(result.message);
                await refreshAllDataAndRender();
            } catch (error) {
                showTemporaryMessage(`Failed to generate work orders. ${error.message}`, true);
            }
        });
        document.getElementById("pmScheduleSearch")?.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const openWorkOrders = state.cache.workOrders.filter(wo => wo.status === 'Open' && wo.wo_type === 'PM');

            const filtered = (state.cache.pmSchedules || []).filter(s => {
                const assetName = state.cache.assets.find(a => a.id === s.assetId)?.name || '';
                return s.title.toLowerCase().includes(searchTerm) ||
                       assetName.toLowerCase().includes(searchTerm);
            });

            const tableBody = document.getElementById("pmSchedulesTableBody");
            tableBody.innerHTML = filtered.map(s => {
                const assetName = state.cache.assets.find(a => a.id === s.assetId)?.name || 'N/A';
                const openWoForSchedule = openWorkOrders.find(wo => wo.pm_schedule_id === s.id);
                let nextStartDate = s.last_generated_date || s.schedule_start_date;
                if (openWoForSchedule) {
                    nextStartDate = openWoForSchedule.start_date;
                }
                const followingPmDate = calculateNextPmDate(s);
                const frequencyText = `${s.frequency_interval} ${s.frequency_unit}(s)`;
                return `<tr class="border-b hover:bg-gray-50">
                    <td class="p-2">${s.title}</td>
                    <td class="p-2">${assetName}</td>
                    <td class="p-2">${frequencyText}</td>
                    <td class="p-2 font-semibold">${nextStartDate || 'N/A'}</td>
                    <td class="p-2 font-semibold">${followingPmDate}</td>
                    <td class="p-2">${s.is_active ? '<span class="text-green-600">Active</span>' : '<span class="text-gray-500">Inactive</span>'}</td>
                    <td class="p-2 space-x-2">
                        <button class="view-pm-btn text-blue-500 hover:text-blue-700" data-id="${s.id}" title="View Details"><i class="fas fa-eye"></i></button>
                        <button class="edit-pm-btn text-yellow-500 hover:text-yellow-700" data-id="${s.id}" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="delete-pm-btn text-red-500 hover:text-red-700" data-id="${s.id}" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`
            }).join('');
        });
    } else if (page === 'locations') {
        document.querySelector('#addCabinetForm')?.addEventListener('submit', async (e) => {
            e.preventDefault(); // This 'e' is the correct browser event object
            const form = e.target;
            const isAdmin = state.currentUser.role === 'Admin';
            
            const locationData = {
                type: 'cabinet',
                name: form.querySelector('input[type="text"]').value,
                // The parentId is the department. For Admins, it's from the select box.
                // For others, it's their own department ID.
                parentId: isAdmin ? form.querySelector('select').value : state.currentUser.departmentId
            };
            
            // Call the reusable action function
            await createLocationAction(locationData);
        });
        
        // All other location forms now use the simplified handler.
        document.getElementById('downloadLocationsBtn')?.addEventListener('click', handleDownloadLocations);
        document.querySelector('#addDivisionForm')?.addEventListener('submit', handleSimpleLocationFormSubmit);
        document.querySelector('#addDepartmentForm')?.addEventListener('submit', handleSimpleLocationFormSubmit);
        document.querySelector('#addSubLineForm')?.addEventListener('submit', handleSimpleLocationFormSubmit);
        document.querySelector('#addProductionLineForm')?.addEventListener('submit', handleSimpleLocationFormSubmit);
        document.querySelector('#addShelfForm')?.addEventListener('submit', handleSimpleLocationFormSubmit);
        document.querySelector('#addBoxForm')?.addEventListener('submit', handleSimpleLocationFormSubmit);
        
    } else if (page === 'inventoryReport') {
        document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (new Date(endDate) < new Date(startDate)) {
                showTemporaryMessage("End Date cannot be before Start Date.", true);
                return;
            }
            // --- START: MODIFICATION ---
            const tableContainer = document.getElementById('reportTableContainer');
            const chartContainer = document.getElementById('inventoryChartContainer');
            tableContainer.innerHTML = '<p>Generating report, please wait...</p>';
            chartContainer.innerHTML = '<canvas id="inventoryChart"></canvas>'; // Reset canvas
            // --- END: MODIFICATION ---

            try {
                const reportData = await api.getInventoryReport({ startDate, endDate });
                let grandTotalValue = 0;
                let tableHTML = `
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold">Report for ${startDate} to ${endDate}</h2>
                        <button id="printReportBtn" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-print mr-2"></i>Print Report</button>
                    </div>
                    <table class="w-full">
                        <thead><tr class="border-b">
                            <th class="p-2 text-left">Part Name (SKU)</th>
                            <th class="p-2 text-right">Starting Qty</th>
                            <th class="p-2 text-right text-green-600">Stock In</th>
                            <th class="p-2 text-right text-red-600">Stock Out</th>
                            <th class="p-2 text-right font-bold">Ending Qty</th>
                            <th class="p-2 text-right">Total Value</th>
                        </tr></thead><tbody>`;
                
                reportData.forEach(item => {
                    grandTotalValue += item.total_value;
                    tableHTML += `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="p-2">${item.name} (${item.sku})</td>
                            <td class="p-2 text-right">${item.starting_qty}</td>
                            <td class="p-2 text-right text-green-600">+${item.stock_in}</td>
                            <td class="p-2 text-right text-red-600">-${item.stock_out}</td>
                            <td class="p-2 text-right font-bold">${item.ending_qty}</td>
                            <td class="p-2 text-right">RM ${item.total_value.toFixed(2)}</td>
                        </tr>`;
                });
                tableHTML += `</tbody><tfoot>
                        <tr class="border-t-2 font-bold">
                            <td class="p-2 text-right" colspan="5">Grand Total Value of Stock</td>
                            <td class="p-2 text-right">RM ${grandTotalValue.toFixed(2)}</td>
                        </tr>
                    </tfoot></table>`;
                
                tableContainer.innerHTML = tableHTML;
                
                // --- START: MODIFICATION ---
                // Call the new chart rendering function
                renderInventoryChart(reportData);
                // --- END: MODIFICATION ---
                
                document.getElementById('printReportBtn').addEventListener('click', () => {
                    printReport(`Inventory Report: ${startDate} to ${endDate}`, tableContainer.innerHTML);
                });
            } catch (error) {
                tableContainer.innerHTML = `<p class="text-red-500">Error generating report: ${error.message}</p>`;
            }
        });
    } else if (page === 'costReport') {
        document.getElementById('costReportForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            // --- START: MODIFICATION ---
            const tableContainer = document.getElementById('costTableContainer');
            const chartContainer = document.getElementById('costChartContainer');
            tableContainer.innerHTML = '<p>Generating cost report, please wait...</p>';
            chartContainer.innerHTML = '<canvas id="costChart"></canvas>'; // Reset canvas
            // --- END: MODIFICATION ---
            
            try {
                const reportData = await api.getCostReport({ startDate, endDate });
                let grandTotalCost = 0;
                
                let tableHTML = `
                    <h2 class="text-xl font-bold mb-4">Report for ${startDate} to ${endDate}</h2>
                    <table class="w-full">
                        <thead><tr class="border-b">
                            <th class="p-2 text-left">Asset Name</th>
                            <th class="p-2 text-left">Department</th>
                            <th class="p-2 text-right">Total Parts Cost</th>
                        </tr></thead><tbody>`;
                
                reportData.forEach(item => {
                    grandTotalCost += item.totalCost;
                    tableHTML += `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="p-2">${item.assetName}</td>
                            <td class="p-2">${item.departmentName}</td>
                            <td class="p-2 text-right">RM ${item.totalCost.toFixed(2)}</td>
                        </tr>`;
                });

                tableHTML += `</tbody><tfoot>
                        <tr class="border-t-2 font-bold">
                            <td class="p-2 text-right" colspan="2">Grand Total Maintenance Cost</td>
                            <td class="p-2 text-right">RM ${grandTotalCost.toFixed(2)}</td>
                        </tr>
                    </tfoot></table>`;
                
                tableContainer.innerHTML = tableHTML;

                // --- START: MODIFICATION ---
                // Call the new chart rendering function
                renderCostChart(reportData);
                // --- END: MODIFICATION ---

            } catch (error) {
                tableContainer.innerHTML = `<p class="text-red-500">Error generating report: ${error.message}</p>`;
            }
        });
    } else if (page === 'kpiReport') {
        document.getElementById('kpiReportForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const container = document.getElementById('reportResultContainer');
            container.innerHTML = '<p>Calculating KPIs, please wait...</p>';
            
            try {
                const reportData = await api.getKpiReport({ startDate, endDate });
                
                let resultHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div class="bg-white p-6 rounded-lg shadow">
                            <h3 class="text-gray-500">Overall MTTR (Mean Time To Repair)</h3>
                            <p class="text-3xl font-bold">${reportData.overall_mttr_hours} Hours</p>
                        </div>
                        <div class="bg-white p-6 rounded-lg shadow">
                            <h3 class="text-gray-500">Overall MTBF (Mean Time Between Failures)</h3>
                            <p class="text-3xl font-bold">${reportData.overall_mtbf_days} Days</p>
                        </div>
                    </div>
                    <h2 class="text-2xl font-bold mb-4">KPIs by Asset</h2>
                    <div class="bg-white p-4 rounded-lg shadow">
                        <table class="w-full">
                            <thead><tr class="border-b">
                                <th class="p-2 text-left">Asset Name</th>
                                <th class="p-2 text-right">MTTR (Hours)</th>
                                <th class="p-2 text-right">MTBF (Days)</th>
                            </tr></thead><tbody>`;
                
                reportData.asset_kpis.forEach(item => {
                    resultHTML += `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="p-2">${item.assetName}</td>
                            <td class="p-2 text-right">${item.mttr_hours}</td>
                            <td class="p-2 text-right">${item.mtbf_days}</td>
                        </tr>`;
                });

                resultHTML += `</tbody></table></div>`;
                container.innerHTML = resultHTML;

            } catch (error) {
                container.innerHTML = `<p class="text-red-500">Error generating KPI report: ${error.message}</p>`;
            }
        });
    } else if (page === 'stockTake') {
        document.getElementById('startStockTakeBtn')?.addEventListener('click', async () => {
            try {
                showTemporaryMessage("Starting new session...");
                const response = await api.startStockTake();
                state.cache.stockTakes = await api.getStockTakes();
                loadAndRenderStockTakeDetails(response.id);
            } catch(error) {
                showTemporaryMessage('Failed to start new session.', true);
            }
        });

        document.getElementById('stockTakeSearch')?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = (state.cache.stockTakes || []).filter(s =>
                s.id.toString().includes(searchTerm) ||
                s.creator_name.toLowerCase().includes(searchTerm)
            );
            document.getElementById('stockTakeTableBody').innerHTML = generateTableRows("stockTakes", filtered);
        });
    } else if (page === 'stockTakeDetails') {
        const detailsId = parseInt(document.querySelector('.page-header-title').dataset.id);
        const details = state.cache.stockTakes.find(s => s.id === detailsId);
        const saveAndSubmitLogic = async (isSubmitting) => {
            const items = Array.from(document.querySelectorAll('.stock-take-qty-input')).map(input => ({
                id: parseInt(input.dataset.id),
                counted_qty: input.value,
            }));
            try {
                await api.saveStockTake({ id: detailsId, items, is_submitting: isSubmitting });
                showTemporaryMessage(isSubmitting ? 'Submitted for approval!' : 'Progress saved.');
                state.cache.stockTakes = await api.getStockTakes();
                if (isSubmitting) {
                    state.currentPage = 'stockTake';
                }
                render();
            } catch(error) {
                showTemporaryMessage('Failed to save data.', true);
            }
        };

        document.getElementById('saveStockTakeProgressBtn')?.addEventListener('click', () => saveAndSubmitLogic(false));
        document.getElementById('submitStockTakeBtn')?.addEventListener('click', () => saveAndSubmitLogic(true));
        
        document.getElementById('approveStockTakeBtn')?.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to approve this count? This will permanently adjust all inventory quantities.')) return;
            try {
                await api.approveStockTake({ id: detailsId });
                showTemporaryMessage('Stock take approved successfully!');
                state.cache.stockTakes = await api.getStockTakes();
                state.currentPage = 'stockTake';
                render();
            } catch(error) {
                showTemporaryMessage('Failed to approve.', true);
            }
        });

        document.getElementById('printStockTakeBtn')?.addEventListener('click', async () => {
            try {
                const printHtml = await api.printStockTake(detailsId);
                printReport(`Stock Take #${detailsId}`, printHtml);
            } catch(error) {
                showTemporaryMessage('Could not generate printable sheet.', true);
            }
        });

        document.getElementById('stockTakeSearch')?.addEventListener('input', async (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const items = await api.getStockTakeDetails(detailsId);
            const filteredItems = items.filter(item =>
                item.name.toLowerCase().includes(searchTerm) ||
                item.sku.toLowerCase().includes(searchTerm)
            );
            document.getElementById('stockTakeItemsContainer').innerHTML = generateTableRows("stockTakeItems", filteredItems, { details });
        });
    } else if (page === 'userManagement') {
        document.getElementById("userSearch")?.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = state.cache.users.filter(user => {
                const departmentName = getUserDepartment(user) || '';
                return user.fullName.toLowerCase().includes(searchTerm) ||
                       user.username.toLowerCase().includes(searchTerm) ||
                       user.role.toLowerCase().includes(searchTerm) ||
                       departmentName.toLowerCase().includes(searchTerm);
            });
            document.getElementById("userTableBody").innerHTML = generateTableRows("users", filtered);
        });
        document.getElementById("addUserBtn")?.addEventListener("click", () => {
            document.getElementById("registrationModalTitle").textContent = 'Add New User';
            document.getElementById("regRole").classList.remove('hidden'); // SHOW role selector
            document.getElementById("registrationModal").style.display = "flex";
            const divisionSelect = document.getElementById('regDivision');
            const departmentSelect = document.getElementById('regDepartment');
            api.getPublicLocations().then(locations => {
                populateLocationDropdowns(divisionSelect, departmentSelect, locations);
            });
        });
    }
    if (page === 'feedback') {
        // Listener for the "Send New Message" button
        document.getElementById('newMessageBtn')?.addEventListener('click', () => {
            if (state.settings.is_messaging_enabled !== '1' && state.currentUser.role !== 'Admin') {
                showTemporaryMessage('The messaging feature is currently disabled by the administrator.', true);
                return;
            }
            // Reset the modal for a new top-level message
            document.getElementById('messageModalTitle').textContent = 'Send Team Message';
            document.getElementById('messageParentId').value = '';
            document.getElementById('messageForm').reset();
            
            const targetRoleContainer = document.getElementById('messageTargetRoleContainer');
            if (['Admin', 'Manager', 'Supervisor'].includes(state.currentUser.role)) {
                targetRoleContainer.style.display = 'block';
            } else {
                targetRoleContainer.style.display = 'none';
            }
            if(state.currentUser.role === 'Admin'){
                 document.getElementById('messageTargetDeptContainer').style.display = 'block';
            } else {
                 document.getElementById('messageTargetDeptContainer').style.display = 'none';
            }
            showMessageModal();
        });

        // Listener for the "Show Archived" button
        document.getElementById('toggleArchivedFeedbackBtn')?.addEventListener('click', () => {
            state.showArchivedFeedback = !state.showArchivedFeedback;
            renderMainContent();
        });

        // Listener for the main message container to handle all clicks inside it
        const messageListContainer = document.getElementById('message-list-container');
        if (messageListContainer) {
            messageListContainer.addEventListener('click', async (e) => {
                const header = e.target.closest('.message-header');
                const statusButton = e.target.closest('.feedback-status-btn');
                const deleteButton = e.target.closest('.feedback-delete-btn');

                // Logic to expand/collapse a message
                if (header) {
                    const messageItem = header.closest('.message-item');
                    const body = messageItem.querySelector('.message-body');
                    const icon = header.querySelector('.fa-chevron-down');

                    body.classList.toggle('hidden');
                    icon.classList.toggle('rotate-180');

                    const messageId = parseInt(messageItem.dataset.id);
                    const currentStatus = messageItem.dataset.status;

                    if (currentStatus === 'New' && !body.classList.contains('hidden')) {
                        try {
                            await api.updateFeedbackStatus(messageId, 'Read');
                            messageItem.dataset.status = 'Read';
                            header.classList.remove('font-bold');
                            header.querySelector('.w-2.h-2.bg-blue-500')?.classList.remove('bg-blue-500');
                            const cachedItem = state.cache.feedback.find(f => f.id === messageId);
                            if (cachedItem) cachedItem.status = 'Read';
                        } catch (error) {
                            console.error("Failed to mark message as read:", error);
                        }
                    }
                }

                // Logic for the 'Archive' or 'Mark as Read' buttons
                if (statusButton) {
                    const id = parseInt(statusButton.dataset.id);
                    const status = statusButton.dataset.status;
                    try {
                        await api.updateFeedbackStatus(id, status);
                        showTemporaryMessage(`Message marked as ${status}.`);
                        state.cache.feedback = await api.getFeedback();
                        renderMainContent();
                    } catch(error) {
                        showTemporaryMessage('Could not update status.', true);
                    }
                }

                // --- START: MODIFIED DELETE LOGIC ---
                // Logic for the 'Delete' button with double-click prevention
                if (deleteButton) {
                    // Disable button immediately and show spinner
                    deleteButton.disabled = true;
                    deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                    const id = parseInt(deleteButton.dataset.id);

                    // Use a small timeout to let the UI update before the confirm dialog appears
                    setTimeout(async () => {
                        if (confirm('Are you sure you want to permanently delete this message?')) {
                            try {
                                await api.deleteFeedback(id);
                                showTemporaryMessage("Message deleted.");
                                state.cache.feedback = await api.getFeedback();
                                renderMainContent(); // Re-renders the page, so no need to re-enable the button
                            } catch (error) {
                                showTemporaryMessage(`Could not delete message: ${error.message}`, true);
                                // If the delete fails, find the button again and re-enable it
                                const buttonStillExists = document.querySelector(`.feedback-delete-btn[data-id="${id}"]`);
                                if (buttonStillExists) {
                                    buttonStillExists.disabled = false;
                                    buttonStillExists.innerHTML = 'Delete';
                                }
                            }
                        } else {
                            // If user cancels, re-enable the button
                            deleteButton.disabled = false;
                            deleteButton.innerHTML = 'Delete';
                        }
                    }, 10);
                }
                // --- END: MODIFIED DELETE LOGIC ---
            });
        }
        const toggle = document.getElementById('messagingToggle');
        toggle?.addEventListener('change', async (e) => {
            const isEnabled = e.target.checked;
            try {
                await api.updateSystemSettings('is_messaging_enabled', isEnabled ? '1' : '0');
                state.settings.is_messaging_enabled = isEnabled ? '1' : '0';
                showTemporaryMessage('Messaging settings updated.');
                renderMainContent();
            } catch (error) {
                showTemporaryMessage('Failed to update settings.', true);
                e.target.checked = !isEnabled;
            }
        });
    }
}

function attachGlobalEventListeners() {
    // Authentication
    document.getElementById("loginForm").addEventListener("submit", (e) => handleLogin(e, loadAndRender));
    document.getElementById("logoutBtn").addEventListener("click", () => handleLogout(render));
    document.getElementById("createAccountBtn").addEventListener("click", () => {
        document.getElementById("registrationModalTitle").textContent = 'Create New Account';
        document.getElementById("regRole").classList.add('hidden'); // Hide role selector
        document.getElementById("registrationModal").style.display = "flex";
        const divisionSelect = document.getElementById('regDivision');
        const departmentSelect = document.getElementById('regDepartment');

        // Always fetch fresh, public location data for the registration form.
        api.getPublicLocations().then(locations => {
            // Pass the fetched data directly to the dropdown population function.
            populateLocationDropdowns(divisionSelect, departmentSelect, locations);
        }).catch(error => {
            console.error("Could not load locations for registration:", error);
            divisionSelect.innerHTML = '<option>Error loading divisions</option>';
            departmentSelect.innerHTML = '<option>Error loading departments</option>';
        });
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
    // Global click handler for delegated events
    document.body.addEventListener("click", (e) => {
        const header = e.target.closest('[data-sort]');
        if (header) {
            const newSortKey = header.dataset.sort;
            if (state.sortKey === newSortKey) {
                state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortKey = newSortKey;
                state.sortOrder = 'asc';
            }
            // Re-render only the main content area, which will trigger the table to be re-drawn and sorted
            renderMainContent();
        }
        const target = e.target;

        const paginationLink = target.closest('.pagination-link');
        if (paginationLink) {
            const page = parseInt(paginationLink.dataset.page);
            const module = paginationLink.dataset.module;
            handlePageChange(module, page);
            return; // Stop further execution
        }

        const kpiBox = target.closest('.dashboard-kpi-box');
        if (kpiBox) {
            const page = kpiBox.dataset.page;
            if (page) {
                state.currentPage = page;
                render();
            }
            return; // Stop further execution
        }

        const notificationItem = e.target.closest('.notification-item');
        if (notificationItem) {
            const type = notificationItem.dataset.notificationType;
            
            // Close the notification modal first
            document.getElementById('notificationModal').style.display = 'none';

            if (type === 'team_message') {
                state.currentPage = 'feedback';
                render(); // Navigate to the team messages page
            } else if (type === 'part_request_update' || type === 'part_request_new') {
                // Navigate directly to the part requests page
                state.currentPage = 'partRequests';
                render(); 
            }
            return; // Stop further execution
        }

        const button = target.closest('button');

        if (e.target.id === "refreshDataBtn") refreshAllDataAndRender();
        if (target.closest("[data-close-modal]")) {
            target.closest(".modal").style.display = "none";
            return;
        }
        if (target.closest('.calendar-day')?.dataset.date) {
             const date = target.closest('.calendar-day').dataset.date;
             const wosOnDay = state.cache.workOrders.filter(wo => wo.start_date === date && can.view(wo));
             showCalendarDetailModal(date, wosOnDay);
             return;
        }
        if (!button) return;
        if (button.classList.contains('feedback-reply-btn')) {
            const messageId = button.dataset.id;
            
            // Set the parent ID in the hidden form field
            document.getElementById('messageParentId').value = messageId;
            
            // Update modal title and hide targeting options for replies
            document.getElementById('messageModalTitle').textContent = 'Post a Reply';
            document.getElementById('messageTargetRoleContainer').style.display = 'none';
            document.getElementById('messageTargetDeptContainer').style.display = 'none';

            // Show the modal
            document.getElementById('messageModal').style.display = 'flex';
            return; // Stop further execution
        }
        if (button && button.id === 'sendFeedbackBtn') {
            showFeedbackToAdminModal(); // This now calls the correct, new modal
            return;
        }
        if (button.classList.contains('view-stock-take-btn')) {
            const stockTakeId = parseInt(button.dataset.id);
            // Explicitly call the function to load the details page
            loadAndRenderStockTakeDetails(stockTakeId);
            return; 
        }
        if (button.classList.contains('sidebar-section-toggle')) {
            const sectionId = button.dataset.sectionId;
            if (sectionId) {
                // Toggle the state for that section
                state.sidebarSections[sectionId] = !state.sidebarSections[sectionId];
                renderSidebar(); // Re-render just the sidebar
            }
            return;
        }
        if (button.id === 'sendFeedbackBtn') {
            showFeedbackToAdminModal(); // Changed from showMessageModal()
            return;
        }
        const id = button.dataset.id ? parseInt(button.dataset.id) : null;
        const actions = {
            "view-asset-btn": () => showAssetDetailModal(state.cache.assets.find(a => a.id === id)),
            "edit-asset-btn": () => {
                populateLocationDropdown(document.getElementById("assetLocation"), "operational");
                showAssetModal(id);
            },
            "delete-asset-btn": () => deleteItem('assets', id),
            "transfer-asset-btn": () => {
                const asset = state.cache.assets.find(a => a.id === id);
                if (asset) {
                    populateLocationDropdown(document.getElementById("transferLocation"), "operational");
                    showTransferAssetModal(asset);
                }
            },
            "dispose-asset-btn": () => handleDisposeAsset(id),
            "view-part-btn": () => showPartDetailModal(state.cache.parts.find(p => p.id === id)),
            "edit-part-btn": () => showPartModal(id),
            "delete-part-btn": () => deleteItem('parts', id),
            "view-wo-btn": () => showWorkOrderDetailModal(state.cache.workOrders.find(w => w.id === id)),
            "edit-wo-btn": () => showWorkOrderModal(id),
            "delete-wo-btn": () => deleteItem('workOrders', id),
            "complete-wo-btn": () => showCompleteWorkOrderModal(state.cache.workOrders.find(w => w.id === id)),
            "start-wo-btn": async () => {
                try {
                    await api.startWorkOrder(id);
                    showTemporaryMessage("Work order status changed to 'In Progress'.");
                    const woResponse = await api.getWorkOrders(state.pagination.workOrders.currentPage);
                    state.cache.workOrders = woResponse.data;
                    renderMainContent();
                } catch (error) {
                    showTemporaryMessage(`Failed to start work order. ${error.message}`, true);
                }
            },
            "edit-user-btn": () => showEditUserModal(id),
            "delete-user-btn": () => deleteItem('users', id),
            "view-pr-btn": () => showPartRequestDetailModal(state.cache.partRequests.find(pr => pr.id === id)),
            "edit-pr-btn": () => {
                const req = state.cache.partRequests.find(pr => pr.id === id);
                const partSelect = document.getElementById('requestPartId');
                partSelect.innerHTML = state.cache.parts.filter(can.view).map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('');
                showEditPartRequestModal(req);
            },
            "delete-pr-btn": () => deletePartRequest(id),
            "approve-pr-btn": () => handlePartRequestAction(id, 'Approved'),
            "reject-pr-btn": () => handlePartRequestAction(id, 'Rejected'),
            "delete-location-btn": () => deleteLocation(button.dataset.type, id),

            // **FIX for Work Order Modal Checklist**
            "addChecklistItemBtn": () => {
                const input = document.getElementById('newChecklistItem');
                if (input.value) { addChecklistItem(input.value, 'woChecklistContainer'); input.value = ''; }
            },
            
            // **FIX for removing any checklist item**
            "remove-checklist-item-btn": () => button.closest('.checklist-item').remove(),

            // **FIX for PM Schedule Modal buttons**
            "addPmChecklistItemBtn": () => {
                const input = document.getElementById('newPmChecklistItem');
                if (input.value) { addChecklistItem(input.value, 'pmChecklistContainer'); input.value = ''; }
            },
            "addPmPartBtn": () => addPmPartRow(),
            "remove-pm-part-btn": () => button.closest('.pm-part-row').remove(),

            "view-pm-btn": () => showPmScheduleDetailModal(state.cache.pmSchedules.find(s => s.id === id)),
            "edit-pm-btn": () => showPmScheduleModal(state.cache.pmSchedules.find(s => s.id === id)),
            "delete-pm-btn": () => {
                if(confirm("Are you sure you want to delete this PM Schedule?")) {
                    api.deletePmSchedule(id).then(() => {
                        showTemporaryMessage("Schedule deleted successfully.");
                        state.cache.pmSchedules = state.cache.pmSchedules.filter(s => s.id !== id);
                        renderMainContent();
                    });
                }
            },
            "toggleArchivedFeedbackBtn": () => {
                state.showArchivedFeedback = !state.showArchivedFeedback;
                renderMainContent();
            },
            "feedback-status-btn": async () => { // <-- AND THIS
                const id = parseInt(button.dataset.id);
                const status = button.dataset.status;
                try {
                    await api.updateFeedbackStatus(id, status);
                    showTemporaryMessage(`Feedback marked as ${status}.`);
                    state.cache.feedback = await api.getFeedback();
                    renderMainContent();
                } catch(error) {
                    showTemporaryMessage('Could not update status.', true);
                }
            },
            "delete-stock-take-btn": () => {
            if (confirm('Are you sure you want to permanently delete this session and all its counting data?')) {
                api.deleteStockTake(id)
                    .then(async () => {
                        showTemporaryMessage("Session deleted successfully.");
                        state.cache.stockTakes = await api.getStockTakes();
                        render();
                    })
                    .catch(error => {
                        showTemporaryMessage(`Failed to delete session: ${error.message}`, true);
                    });
            }
        },
        };
        for (const cls in actions) {
            if (button.classList.contains(cls) || button.id === cls) {
                actions[cls]();
                break;
            }
        }
    });
    document.getElementById('notificationBellBtn').addEventListener('click', async () => {
        const badge = document.getElementById('notificationBadge');
        
        // Show the modal first
        showNotificationModal();
        
        // Then, mark notifications as read
        const unreadCount = parseInt(badge.textContent);
        if (unreadCount > 0) {
            const notifications = await api.getNotifications();
            if (notifications.length > 0) {
                const idsToMarkAsRead = notifications.map(n => n.id);
                await api.markNotificationsRead({ ids: idsToMarkAsRead });
                badge.classList.add('hidden');
            }
        }
    });


    // Form Submissions
    document.getElementById("assetForm").addEventListener("submit", handleAssetFormSubmit);
    document.getElementById("partForm").addEventListener("submit", handlePartFormSubmit);
    document.getElementById("workOrderForm").addEventListener("submit", handleWorkOrderFormSubmit);
    document.getElementById("editUserForm").addEventListener("submit", handleEditUserFormSubmit);
    document.getElementById("transferAssetForm").addEventListener("submit", handleTransferAssetFormSubmit);
    document.getElementById("completeWorkOrderForm").addEventListener("submit", handleCompleteWorkOrderFormSubmit);
    document.getElementById("partRequestForm").addEventListener("submit", handlePartRequestFormSubmit);
    document.getElementById("storageRequestForm").addEventListener("submit", handleStorageRequestFormSubmit);
    document.getElementById("receivePartsForm").addEventListener("submit", handleReceivePartsFormSubmit);
    document.getElementById("restockPartsForm").addEventListener("submit", handleRestockPartsFormSubmit);
    document.getElementById("pmScheduleForm").addEventListener("submit", handlePmScheduleFormSubmit);
    document.getElementById("messageForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const message = document.getElementById("messageBody").value;
        const targetRole = document.getElementById("messageTargetRole").value;
        const targetDept = document.getElementById("messageTargetDept").value;

        const parentId = document.getElementById("messageParentId").value;
        
        const payload = { message, parentId }; // Add parentId to payload
        
        // Only add targeting info if it's a new message, not a reply
        if (!parentId) {
            payload.target_role = targetRole;
            if (state.currentUser.role === 'Admin' && targetDept) {
                payload.department_id = targetDept;
            }
        }

        try {
            await api.submitFeedback(payload); // The API endpoint is the same
            showTemporaryMessage("Message sent successfully!");
            document.getElementById("messageModal").style.display = "none";
            state.cache.feedback = await api.getFeedback();
            renderMainContent();
        } catch(error) {
            showTemporaryMessage(`Failed to send message: ${error.message}`, true);
        }
    });
    document.getElementById("feedbackToAdminForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const message = document.getElementById("feedbackToAdminBody").value;
        try {
            // We use the existing submitFeedback API, but send our special 'action'
            await api.submitFeedback({ message, action: 'send_to_admin' });
            showTemporaryMessage("Your feedback has been sent to the administrator. Thank you!");
            document.getElementById("feedbackToAdminModal").style.display = "none";
        } catch(error) {
            showTemporaryMessage(`Failed to send feedback: ${error.message}`, true);
        }
    });
}

async function checkForNotifications() {
    try {
        const notifications = await api.getNotifications();
        if (notifications && notifications.length > 0) {
            const idsToMarkAsRead = [];
            
            notifications.forEach((req, index) => {
                const partName = req.newPartName || `request #${req.id}`;
                const isError = req.status === 'Rejected';
                const message = `Update: Your request for "${partName}" has been ${req.status}.`;
                
                // Use a timeout to stagger the notifications
                setTimeout(() => {
                    showTemporaryMessage(message, isError);
                }, index * 1500);

                idsToMarkAsRead.push(req.id);
            });

            // After showing all notifications, mark them as read
            if (idsToMarkAsRead.length > 0) {
                await api.markNotificationsRead({ ids: idsToMarkAsRead });
            }
        }
    } catch (error) {
        console.error("Failed to check for notifications:", error);
    }
}

async function deletePartRequest(id) {
    if (confirm("Are you sure you want to permanently delete this part request?")) {
        try {
            await api.deletePartRequest(id);
            await logActivity("Part Request Deleted", `Deleted request ID: ${id}`);
            
            // --- START: MODIFICATION ---
            // Ensure the cache is updated correctly after deletion
            const prResponse = await api.getPartRequests(1);
            state.cache.partRequests = prResponse.data;
            // --- END: MODIFICATION ---

            renderMainContent();
            showTemporaryMessage("Request deleted successfully.");
        } catch (error) {
            showTemporaryMessage(`Failed to delete request. ${error.message}`, true);
        }
    }
}

async function handleFileUpload(file, type) {
    if (!file) return;
    if (file.type !== 'text/csv') {
        showTemporaryMessage('Please upload a valid .csv file.', true);
        return;
    }

    const resultDiv = document.getElementById('uploadResult');
    document.getElementById('uploadInstructions').style.display = 'none';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<p>Processing file... please wait.</p>`;

    let processedRowCount = 0;
    
    Papa.parse(file, {
        header: true, // Automatically uses the first row as keys
        skipEmptyLines: true,
        worker: true, // Use a separate thread for performance
        
        // 'chunk' is called for each batch of rows
        chunk: async (results, parser) => {
            // Pause the parser to wait for the API call to complete
            parser.pause(); 
            
            const chunkData = results.data;
            processedRowCount += chunkData.length;
            resultDiv.innerHTML = `<p>Processing... Processed ${processedRowCount} rows.</p>`;

            try {
                let response;
                if (type === 'assets') {
                    response = await api.bulkUpdateAssets(chunkData);
                } else if (type === 'parts') {
                    response = await api.bulkUpdateParts(chunkData);
                }

                if (response.failed > 0) {
                    // If any part of a chunk fails, stop the entire upload
                    parser.abort();
                    let errorHTML = `<p class="font-bold text-red-600">Upload failed at row ~${processedRowCount}. No changes were saved.</p>`;
                    if(response.errors && response.errors.length > 0) {
                         errorHTML += `<p class="font-bold mt-2">Error Details:</p><ul class="text-sm list-disc list-inside">`;
                         response.errors.forEach(err => { errorHTML += `<li>${err}</li>`; });
                         errorHTML += `</ul>`;
                    }
                    resultDiv.innerHTML = errorHTML;
                    return; // Stop processing
                }

            } catch (error) {
                // Handle network or server errors
                parser.abort();
                resultDiv.innerHTML = `<p class="text-red-500">A critical error occurred: ${error.message}</p>`;
                return; // Stop processing
            }

            // Resume parsing the next chunk
            parser.resume();
        },

        // 'complete' is called when the entire file is done
        complete: async () => {
            resultDiv.innerHTML = `<p class="font-bold text-green-600">Upload complete! Successfully processed ${processedRowCount} rows.</p>`;
            // Perform a full refresh to show the new/updated data
            await refreshAllDataAndRender();
        },
        
        // 'error' is called if Papa Parse encounters an issue
        error: (error) => {
            resultDiv.innerHTML = `<p class="text-red-500">Failed to parse CSV file: ${error.message}</p>`;
        }
    });
}

// js/app.js

function handleDownloadLocations() {
    const { 
        divisions = [], departments = [], subLines = [], productionLines = [],
        cabinets = [], shelves = [], boxes = [] 
    } = state.cache.locations || {};
    
    // Define CSV header
    let csvContent = "data:text/csv;charset=utf-8,locationId,fullLocationName\r\n";
    
    const appendToCsv = (id, fullName) => {
        // Sanitize name in case it contains commas
        const sanitizedName = `"${fullName.replace(/"/g, '""')}"`;
        csvContent += `${id},${sanitizedName}\r\n`;
    };

    // --- START: FIX - Iterate through ALL location types ---
    divisions.forEach(loc => appendToCsv(`div-${loc.id}`, getFullLocationName(`div-${loc.id}`)));
    departments.forEach(loc => appendToCsv(`dept-${loc.id}`, getFullLocationName(`dept-${loc.id}`)));
    subLines.forEach(loc => appendToCsv(`sl-${loc.id}`, getFullLocationName(`sl-${loc.id}`)));
    productionLines.forEach(loc => appendToCsv(`pl-${loc.id}`, getFullLocationName(`pl-${loc.id}`)));
    cabinets.forEach(loc => appendToCsv(`cab-${loc.id}`, getFullLocationName(`cab-${loc.id}`)));
    shelves.forEach(loc => appendToCsv(`sh-${loc.id}`, getFullLocationName(`sh-${loc.id}`)));
    boxes.forEach(loc => appendToCsv(`box-${loc.id}`, getFullLocationName(`box-${loc.id}`)));
    // --- END: FIX ---

    // Create a link and trigger the download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "location_ids_complete.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showTemporaryMessage("Complete location list download started.");
}

// js/app.js

async function loadAndRenderStockTakeDetails(stockTakeId) {
    const mainContent = document.getElementById("mainContent");
    try {
        mainContent.innerHTML = "<p>Loading stock take details...</p>";

        // --- START: FIX ---
        // Use Promise.all to fetch both the session details and the items list directly.
        // This is more reliable than using the cache.
        const [details, items] = await Promise.all([
            api.getStockTakeSession(stockTakeId),
            api.getStockTakeDetails(stockTakeId)
        ]);
        // --- END: FIX ---

        if (!details || !items) {
            throw new Error("Could not load all required data for the stock take session.");
        }
        
        mainContent.innerHTML = renderStockTakeCountPage(items, details);
        attachPageSpecificEventListeners('stockTakeDetails');

    } catch(error) {
        showTemporaryMessage(error.message, true);
        state.currentPage = 'stockTake';
        render(); // Go back to the list view on failure
    }
}

async function fetchAndDisplayNotifications() {
    if (!state.currentUser) {
        return;
    }
    try {
        const notifications = await api.getNotifications();
        const badge = document.getElementById('notificationBadge');

        if (notifications && notifications.length > 0) {
            badge.textContent = notifications.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
        return notifications;
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
    }
}

async function createLocationAction(locationData) {
    try {
        await api.createLocation(locationData);
        await logActivity("Location Created", `Created new ${locationData.type}: ${locationData.name}`);
        state.cache.locations = await api.getLocations();
        renderMainContent();
        showTemporaryMessage(`${locationData.type} created successfully.`);
    } catch (error) {
        showTemporaryMessage(`Failed to create ${locationData.type}. ${error.message}`, true);
    }
}

async function handleSimpleLocationFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    let type, name, parentId;

    // A map to correctly identify the location type from the form's ID
    const typeMap = {
        'addDivisionForm': { type: 'division', hasParent: false },
        'addDepartmentForm': { type: 'department', hasParent: true },
        'addSubLineForm': { type: 'subLine', hasParent: true },
        'addProductionLineForm': { type: 'productionLine', hasParent: true },
        'addShelfForm': { type: 'shelf', hasParent: true },
        'addBoxForm': { type: 'box', hasParent: true }
    };

    const formConfig = typeMap[form.id];
    if (!formConfig) {
        showTemporaryMessage('Unknown form submission.', true);
        return;
    }
    
    type = formConfig.type;
    name = form.querySelector('input[type="text"]').value;
    parentId = formConfig.hasParent ? form.querySelector('select').value : null;
    
    await createLocationAction({ type, name, parentId });
}

// js/app.js

// --- APPLICATION INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    attachGlobalEventListeners();
    render();
    const refreshInterval = 5 * 60 * 1000; 
    setInterval(refreshAllDataAndRender, refreshInterval);
    const notificationInterval = 30 * 1000;
    setInterval(fetchAndDisplayNotifications, notificationInterval);
});