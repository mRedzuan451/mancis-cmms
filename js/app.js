// js/app.js

import { state } from './config.js';
import { api } from './api.js';
import { handleLogin, handleLogout, handleRegistration, can } from './auth.js';
import { logActivity, showTemporaryMessage, printReport, getFullLocationName } from './utils.js';
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
    renderFeedbackPage,
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
    showFeedbackModal,
    renderStatusChart,
    addChecklistItem,
    addPmPartRow,
    showUploadModal,
    renderCostReportPage,
    renderKpiReportPage,
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
        case "feedback":            content = renderFeedbackPage(); break;
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
        const dataMap = {}; 

        const publicLocationsPromise = api.getPublicLocations();

        dataMap.users = api.getUsers();

        if (permissions.asset_view) {
            dataMap.assets = api.getAssets();
        }
        if (permissions.part_view) {
            dataMap.parts = api.getParts();
        }
        if (permissions.user_view) {
            dataMap.users = api.getUsers();
        }
        if (permissions.wo_view) {
            dataMap.workOrders = api.getWorkOrders();
        }
        if (permissions.part_request_view) {
            dataMap.partRequests = api.getPartRequests();
        }
        // This will fetch the FULL location data for authorized users, overwriting the public data later.
        if (permissions.location_management) {
            dataMap.locations = api.getLocations();
        }
        if (permissions.log_view) {
            dataMap.logs = api.getLogs();
        }
        if (permissions.pm_schedule_view) {
            dataMap.pmSchedules = api.getPmSchedules();
        }
        if (permissions.stock_take_create) {
            dataMap.stockTakes = api.getStockTakes();
        }
        if (permissions.feedback_view) {
            dataMap.feedback = api.getFeedback();
        }
        
        dataMap.receivedParts = api.getReceivedParts();
        
        const promises = Object.values(dataMap);
        const keys = Object.keys(dataMap);
        const results = await Promise.all(promises);

        // --- START: FIX ---
        // 2. First, put the public locations into the cache.
        state.cache.locations = await publicLocationsPromise;
        // --- END: FIX ---

        // 3. Then, populate the rest of the cache. If full locations were fetched, they will overwrite the public ones.
        results.forEach((result, index) => {
            state.cache[keys[index]] = result;
        });

    } catch (error) {
        showTemporaryMessage("Failed to load application data. Please try again.", true);
        console.error("Error during initial data load:", error);
    }
}

async function loadAndRender() {
    await loadInitialData();
    try {
        await api.updateOverdueWorkOrders();
        // Then, re-fetch the work orders to get the updated statuses.
        state.cache.workOrders = await api.getWorkOrders();
    } catch (error) {
        console.error("Failed to update overdue work orders:", error);
    }
    render();
    await checkForLowStockAndCreateRequests();
    await checkForNotifications();
}

async function refreshAllDataAndRender() {
    const isModalOpen = !!document.querySelector('.modal[style*="display: flex"]');
    if (isModalOpen) {
        console.log("Refresh skipped: a modal is open.");
        return;
    }
    console.log("Refreshing data...");
    showTemporaryMessage("Refreshing data...");
    try {
        await loadInitialData();
        renderMainContent();
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
        state.cache.partRequests = await api.getPartRequests();
        if(state.currentPage === 'partRequests') renderMainContent();
    }
}

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
      relatedParts: Array.from(document.getElementById("assetRelatedParts").selectedOptions).map(opt => opt.value),
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

async function deleteItem(type, id) {
    const typeName = type.slice(0, -1);

    // --- FIX: Add frontend safety checks for deleting users ---
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
        switch (type) {
            case 'assets':
                itemToDelete = state.cache.assets.find(i => i.id === id);
                await api.deleteAsset(id);
                state.cache.assets = await api.getAssets();
                state.cache.workOrders = await api.getWorkOrders();
                break;
            case 'parts':
                itemToDelete = state.cache.parts.find(i => i.id === id);
                await api.deletePart(id);
                state.cache.parts = await api.getParts();
                break;
            case 'workOrders':
                itemToDelete = state.cache.workOrders.find(i => i.id === id);
                await api.deleteWorkOrder(id);
                state.cache.workOrders = await api.getWorkOrders();
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
        state.cache.parts = await api.getParts();
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
        start_date: document.getElementById("woStartDate").value,
        dueDate: document.getElementById("woDueDate").value,
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
        state.cache.workOrders = await api.getWorkOrders();
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
        state.cache.workOrders = await api.getWorkOrders();
        document.getElementById('completeWorkOrderModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("Work Order marked as complete!");

    } catch (error) {
        showTemporaryMessage(`Failed to complete Work Order. ${error.message}`, true);
    }
}

async function handlePartRequestFormSubmit(e) {
    e.preventDefault();
    const requestId = document.getElementById('partRequestId').value;
    const isEditing = !!requestId;

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
                purpose: document.getElementById('requestPurpose').value,
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
        state.cache.partRequests = await api.getPartRequests();
        document.getElementById('partRequestModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage(`Part request ${isEditing ? 'updated' : 'submitted'} successfully!`);

    } catch (error) {
        showTemporaryMessage(`Failed to save request. ${error.message}`, true);
    }
}

async function handleStorageRequestFormSubmit(e) {
    e.preventDefault();
    let requestData = {
        partId: parseInt(document.getElementById('storageRequestPartId').value),
        quantity: parseInt(document.getElementById('storageRequestQuantity').value),
        purpose: document.getElementById('storageRequestPurpose').value,
        requesterId: state.currentUser.id,
        requestDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
        status: 'Requested from Storage',
    };
     try {
        await api.createPartRequest(requestData);
        await logActivity("Storage Request Submitted", `User requested ${requestData.quantity} x part ID ${requestData.partId} from storage`);
        state.cache.partRequests = await api.getPartRequests();
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
        state.cache.partRequests = await api.getPartRequests();
        if (newStatus === 'Approved') state.cache.parts = await api.getParts();
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
        state.cache.partRequests = await api.getPartRequests();
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
                payload.partId = parseInt(document.getElementById('directStockPartId').value);
                logMessage = `Direct restock (existing part): ${payload.quantity} x Part ID ${payload.partId}`;
            }
            await api.directRestockPart(payload);
        } else {
            const receivedId = parseInt(document.getElementById('restockPartId').value);
            const locationId = document.getElementById('restockLocationId').value;
            await api.restockParts({ receivedId, locationId });
            logMessage = `Restocked parts from received request ID: ${receivedId}`;
        }
        
        // This log is created by the backend, but we can add a frontend one too if needed.
        // await logActivity("Parts Restocked", logMessage);
        
        // Refresh caches for data that has changed.
        state.cache.receivedParts = await api.getReceivedParts();
        state.cache.partRequests = await api.getPartRequests();
        state.cache.parts = await api.getParts();
        
        // --- START: FIX ---
        // Only refresh the logs if the user has permission to view them.
        if (state.currentUser.permissions.log_view) {
            state.cache.logs = await api.getLogs();
        }
        // --- END: FIX ---
        
        document.getElementById('restockPartsModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("Parts restocked successfully.");

    } catch (error) {
        showTemporaryMessage(`Failed to restock parts. ${error.message}`, true);
    }
}

async function handleLocationFormSubmit(e) {
    if (e.preventDefault) e.preventDefault();
    const form = e.target;
    let type, name, parentId;

    if (e.type) { // It's our custom object
        type = e.type;
        name = e.name;
        parentId = e.parentId;
    } else { // It's a real form event
        const formId = form.id;
        switch(formId) {
            case 'addDivisionForm':
                type = 'division'; name = form.querySelector('input').value; break;
            case 'addDepartmentForm':
                type = 'department'; name = form.querySelector('input').value; parentId = form.querySelector('select').value; break;
            case 'addSubLineForm':
                type = 'subLine'; name = form.querySelector('input').value; parentId = form.querySelector('select').value; break;
            case 'addProductionLineForm':
                type = 'productionLine'; name = form.querySelector('input').value; parentId = form.querySelector('select').value; break;
            case 'addShelfForm':
                type = 'shelf'; name = form.querySelector('input').value; parentId = form.querySelector('select').value; break;
            case 'addBoxForm':
                type = 'box'; name = form.querySelector('input').value; parentId = form.querySelector('select').value; break;
            default: return;
        }
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
        
        // --- START: ADDED SEARCH LOGIC ---
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

            const title = "Part Purchase List";
            let content = `<h1>${title}</h1><p>Generated on: ${new Date().toLocaleString()}</p>`;
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

            requestsToPrint.forEach(req => {
                const part = req.partId ? state.cache.parts.find(p => p.id === req.partId) : null;
                const requester = state.cache.users.find(u => u.id === req.requesterId);

                const partName = part ? part.name : (req.newPartName || 'N/A');
                const partNumber = part ? part.sku : (req.newPartNumber || 'N/A');
                const maker = part ? part.maker : (req.newPartMaker || '');
                const requesterName = requester ? requester.fullName : 'N/A';
                
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
        document.querySelector('#addCabinetForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = e.target.querySelector('input').value;
            // The parentId is the currently selected department
            handleLocationFormSubmit({
                target: e.target,
                type: 'cabinet',
                name: name,
                parentId: state.selectedLocationDepartmentId
            });
        });
        document.getElementById('downloadLocationsBtn')?.addEventListener('click', handleDownloadLocations);
        document.querySelector('#addDivisionForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addDepartmentForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addSubLineForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addProductionLineForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addShelfForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addBoxForm')?.addEventListener('submit', handleLocationFormSubmit);
    } else if (page === 'inventoryReport') {
        // --- Report Generation Logic ---
        document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (new Date(endDate) < new Date(startDate)) {
                showTemporaryMessage("End Date cannot be before Start Date.", true);
                return;
            }
            const container = document.getElementById('reportResultContainer');
            container.innerHTML = '<p>Generating report, please wait...</p>';
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
                
                container.innerHTML = tableHTML;
                
                document.getElementById('printReportBtn').addEventListener('click', () => {
                    printReport(`Inventory Report: ${startDate} to ${endDate}`, container.innerHTML);
                });
            } catch (error) {
                container.innerHTML = `<p class="text-red-500">Error generating report: ${error.message}</p>`;
            }
        });
    } else if (page === 'costReport') {
        document.getElementById('costReportForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const container = document.getElementById('reportResultContainer');
            container.innerHTML = '<p>Generating cost report, please wait...</p>';
            
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
                
                container.innerHTML = tableHTML;
            } catch (error) {
                container.innerHTML = `<p class="text-red-500">Error generating report: ${error.message}</p>`;
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
    } else if (page === 'stockTakeDetails') {
        const detailsId = parseInt(document.querySelector('.page-header-title').dataset.id);

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
        const target = e.target;

        const kpiBox = target.closest('.dashboard-kpi-box');
        if (kpiBox) {
            const page = kpiBox.dataset.page;
            if (page) {
                state.currentPage = page;
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
            "sendFeedbackBtn": () => showFeedbackModal(), // <-- ADD THIS
            "toggleArchivedFeedbackBtn": () => {
                state.showArchivedFeedback = !state.showArchivedFeedback;
                renderMainContent();
            },
            "feedback-delete-btn": async () => {
                if (confirm('Are you sure you want to permanently delete this feedback message?')) {
                    try {
                        await api.deleteFeedback(id);
                        showTemporaryMessage("Feedback deleted.");
                        // Refresh the list from the server
                        state.cache.feedback = await api.getFeedback();
                        renderMainContent();
                    } catch (error) {
                        showTemporaryMessage('Could not delete feedback.', true);
                    }
                }
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
    document.getElementById("feedbackForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const message = document.getElementById("feedbackMessage").value;
        try {
            await api.submitFeedback(message);
            showTemporaryMessage("Thank you! Your feedback has been sent.");
            document.getElementById("feedbackModal").style.display = "none";
        } catch(error) {
            showTemporaryMessage(`Submission failed: ${error.message}`, true);
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
            state.cache.partRequests = await api.getPartRequests();
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

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            resultDiv.innerHTML = `<p class="text-red-500">Error: CSV file must have a header row and at least one data row.</p>`;
            return;
        }

        const header = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const values = line.split(',');
            const rowObject = {};
            header.forEach((key, index) => {
                rowObject[key] = values[index] ? values[index].trim() : '';
            });
            return rowObject;
        });

        try {
            let response;
            if (type === 'assets') {
                response = await api.bulkUpdateAssets(rows);
            } else if (type === 'parts') {
                response = await api.bulkUpdateParts(rows);
            }

            let resultHTML = `<p class="font-bold text-green-600">${response.message}</p><ul>`;
            resultHTML += `<li><strong>Created:</strong> ${response.created}</li>`;
            resultHTML += `<li><strong>Updated:</strong> ${response.updated}</li>`;
            if (response.failed > 0) {
                resultHTML += `<li class="text-red-500"><strong>Failed:</strong> ${response.failed}</li>`;
                resultHTML += `</ul><p class="font-bold mt-2">Error Details:</p><ul class="text-sm list-disc list-inside">`;
                response.errors.forEach(err => {
                    resultHTML += `<li>${err}</li>`;
                });
                resultHTML += `</ul>`;
            } else {
                resultHTML += `</ul>`;
            }
            resultDiv.innerHTML = resultHTML;
            refreshAllDataAndRender();
        } catch (error) {
            resultDiv.innerHTML = `<p class="text-red-500">An error occurred: ${error.message}</p>`;
        }
    };
    reader.readAsText(file);
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

// js/app.js

// --- APPLICATION INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    attachGlobalEventListeners();
    render();
    // --- ADD THIS BLOCK FOR AUTOMATIC REFRESHING ---
    // Set an interval to automatically refresh data every 5 minutes (300,000 milliseconds)
    const refreshInterval = 5 * 60 * 1000; 
    setInterval(refreshAllDataAndRender, refreshInterval);
});