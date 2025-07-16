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
    renderInventoryReportPage,
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
    showTransferAssetModal,
    showCompleteWorkOrderModal,
    showPartRequestModal,
    showStorageRequestModal,
    showReceivePartsModal,
    showRestockPartsModal,
    addChecklistItem,
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
        case "activityLog":         content = renderActivityLogPage(); break;
        case "partRequests":        content = renderPartsRequestPage(); break;
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

// js/app.js

async function loadInitialData() {
    try {
        const { role } = state.currentUser;
        
        // Start with promises that everyone can access
        const promises = [
            api.getPartRequests(),
            api.getLocations(),
            api.getReceivedParts(),
        ];

        // Conditionally add promises based on user role
        if (role === 'Admin') {
            promises.push(api.getAssets(), api.getParts(), api.getUsers(), api.getWorkOrders(), api.getLogs());
        } else if (role !== 'Clerk') {
            // For Manager, Supervisor, Engineer, Technician
            promises.push(api.getAssets(), api.getParts(), api.getUsers(), api.getWorkOrders());
        }

        const results = await Promise.all(promises);

        // Assign results to the cache based on what was fetched
        // This is more complex but correctly handles the partial data
        state.cache.partRequests = results[0];
        state.cache.locations = results[1];
        state.cache.receivedParts = results[2];
        
        if (role === 'Admin') {
            state.cache.assets = results[3];
            state.cache.parts = results[4];
            state.cache.users = results[5];
            state.cache.workOrders = results[6];
            state.cache.logs = results[7];
        } else if (role !== 'Clerk') {
            state.cache.assets = results[3];
            state.cache.parts = results[4];
            state.cache.users = results[5];
            state.cache.workOrders = results[6];
        }

    } catch (error) {
        showTemporaryMessage("Failed to load initial application data. Please try again.", true);
        handleLogout(render);
    }
}

async function loadAndRender() {
    await loadInitialData();
    render();
    await checkForLowStockAndCreateRequests();
}


// --- ACTION HANDLERS (Forms, Deletes, etc.) ---

async function checkForLowStockAndCreateRequests() {
    console.log("Checking for low stock parts...");
    const lowStockParts = state.cache.parts.filter(p => p.quantity <= p.minQuantity);

    if (lowStockParts.length === 0) {
        console.log("No low stock parts found.");
        return;
    }

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
                
                await api.createAutoPartRequest({
                    partId: part.id,
                    quantity: requestQty
                });
                console.log(`Successfully created automatic request for part: ${part.name}`);
            } catch (error) {
                console.error(`Failed to create request for part ${part.name}:`, error);
            }
        }
        state.cache.partRequests = await api.getPartRequests();
        if(state.currentPage === 'partRequests') {
            renderMainContent();
        }
    } else {
        console.log("All low stock parts already have an open request.");
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
        await logActivity(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} Deleted`, `Deleted ${typeName}: ${itemToDelete.name || itemToDelete.title || itemToDelete.fullName} (ID: ${id})`);
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
        dueDate: document.getElementById("woDueDate").value,
        breakdownTimestamp: document.getElementById("woBreakdownTime").value || null,
        priority: document.getElementById("woPriority").value,
        frequency: document.getElementById("woFrequency").value,
        status: document.getElementById("woStatus").value,
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
    const role = document.getElementById('editUserRole').value;

    try {
        await api.updateUserRole({ userId, role });
        await logActivity("User Role Updated", `Changed role for user ID ${userId} to ${role}`);
        state.cache.users = await api.getUsers();
        document.getElementById('editUserModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("User role updated successfully!");
    } catch (error) {
        showTemporaryMessage(`Failed to update user role. ${error.message}`, true);
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
            // Logic for UPDATING an existing request
            const requestData = {
                partId: parseInt(document.getElementById('requestPartId').value),
                quantity: parseInt(document.getElementById('requestQuantity').value),
                purpose: document.getElementById('requestPurpose').value,
            };
            await api.updatePartRequest(requestId, requestData);
            await logActivity("Part Request Updated", `Updated request ID: ${requestId}`);
        } else {
            // Logic for CREATING a new request
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
        newPartName: null,
        newPartNumber: null,
        newPartMaker: null,
        notes: ''
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

// js/app.js

async function handlePartRequestAction(id, newStatus) {
    let rejectionReason = null;

    // If rejecting, prompt for a reason
    if (newStatus === 'Rejected') {
        rejectionReason = prompt("Please provide a reason for rejecting this request:");
        // If the user clicks "Cancel" on the prompt, stop the function
        if (rejectionReason === null) {
            return; 
        }
    }

    if (!confirm(`Are you sure you want to ${newStatus.toLowerCase()} this request?`)) return;
    
    try {
        await api.updatePartRequestStatus({
            id,
            status: newStatus,
            approverId: state.currentUser.id,
            rejectionReason: rejectionReason // Send the reason to the API
        });
        await logActivity(`Part Request ${newStatus}`, `Request ID ${id} was marked as ${newStatus}`);
        state.cache.partRequests = await api.getPartRequests();
        if (newStatus === 'Approved') {
            state.cache.parts = await api.getParts();
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
        await api.receiveParts({
            requestId,
            receiverId: state.currentUser.id
        });
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

// js/app.js

async function handleRestockPartsFormSubmit(e) {
    e.preventDefault();
    
    // Check which mode is active by seeing which container is visible
    const isDirectStockMode = document.getElementById('directStockContainer').style.display === 'block';
    
    try {
        let payload = {};
        
        if (isDirectStockMode) {
            const isNewPart = document.getElementById('isNewPartCheckbox').checked;
            
            payload = {
                quantity: parseInt(document.getElementById('directStockQuantity').value),
                locationId: document.getElementById('restockLocationId').value,
                notes: document.getElementById('directStockNotes').value
            };

            if (isNewPart) {
                // --- Handle New Part Creation ---
                payload.newPartName = document.getElementById('newPartName').value;
                payload.newPartSku = document.getElementById('newPartSku').value;
                payload.newPartMaker = document.getElementById('newPartMaker').value;
                payload.newPartCategory = document.getElementById('newPartCategory').value;
            } else {
                // --- Handle Direct Stock of Existing Part ---
                payload.partId = parseInt(document.getElementById('directStockPartId').value);
            }
            await api.directRestockPart(payload);

        } else {
            // --- Handle Restock from Request ---
            const receivedId = parseInt(document.getElementById('restockPartId').value);
            const locationId = document.getElementById('restockLocationId').value;
            await api.restockParts({ receivedId, locationId });
        }
        
        // Refresh all relevant data caches to update the UI
        state.cache.receivedParts = await api.getReceivedParts();
        state.cache.partRequests = await api.getPartRequests();
        state.cache.parts = await api.getParts();
        state.cache.logs = await api.getLogs();
        
        document.getElementById('restockPartsModal').style.display = 'none';
        renderMainContent();
        showTemporaryMessage("Parts restocked successfully.");

    } catch (error) {
        showTemporaryMessage(`Failed to restock parts. ${error.message}`, true);
    }
}

async function handleLocationFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formId = form.id;
    let type, name, parentId;

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
            parentId = form.querySelector('select').value;
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
        default: return;
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


// --- EVENT LISTENER ATTACHMENT ---

function attachPageSpecificEventListeners(page) {
    if (page === 'assets') {
        document.getElementById("addAssetBtn")?.addEventListener("click", () => {
            // Note: I've updated this call to match the fix from your last request.
            populateLocationDropdown(document.getElementById("assetLocation"), "operational");
            showAssetModal();
        });

        document.getElementById("assetSearch")?.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = state.cache.assets.filter(can.view).filter(a =>
                a.name.toLowerCase().includes(searchTerm) ||
                a.tag.toLowerCase().includes(searchTerm) ||
                a.category.toLowerCase().includes(searchTerm) ||
                // --- ADD THIS LINE TO SEARCH BY LOCATION ---
                getFullLocationName(a.locationId).toLowerCase().includes(searchTerm)
            );
            document.getElementById("assetTableBody").innerHTML = generateTableRows("assets", filtered);
        });

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
         document.getElementById("addPartBtn")?.addEventListener("click", () => {
            showPartModal();
        });
         document.getElementById("partSearch")?.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = state.cache.parts.filter(can.view).filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.sku.toLowerCase().includes(searchTerm) ||
                p.category.toLowerCase().includes(searchTerm)
            );
            document.getElementById("partTableBody").innerHTML = generateTableRows("parts", filtered);
        });
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
                            <th style="padding: 5px; text-align: left;">Category</th>
                            <th style="padding: 5px; text-align: right;">Quantity</th>
                            <th style="padding: 5px; text-align: left;">Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${partsToPrint.map(part => `
                            <tr>
                                <td style="padding: 5px;">${part.name}</td>
                                <td style="padding: 5px;">${part.sku}</td>
                                <td style="padding: 5px;">${part.category}</td>
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
        
        // --- ADD THIS BLOCK FOR TAB FILTERING ---
        document.querySelectorAll('.wo-type-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const selectedType = e.target.dataset.type;

                // Update tab styles
                document.querySelectorAll('.wo-type-tab').forEach(t => {
                    t.classList.remove('text-blue-600', 'border-blue-500');
                    t.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
                });
                e.target.classList.add('text-blue-600', 'border-blue-500');
                e.target.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');

                // Filter the work orders and re-render the table body
                const allWorkOrders = state.cache.workOrders.filter(can.view);
                const filteredWOs = selectedType === 'All' 
                    ? allWorkOrders
                    : allWorkOrders.filter(wo => wo.wo_type === selectedType);
                
                document.getElementById('workOrderTableBody').innerHTML = generateTableRows("workOrders", filteredWOs);
            });
        });
        
        // This search listener code remains the same
        document.getElementById("workOrderSearch")?.addEventListener("input", (e) => { /* ... */ });
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
        document.getElementById('storageRequestBtn')?.addEventListener('click', showStorageRequestModal);
        document.getElementById('receivePartsBtn')?.addEventListener('click', showReceivePartsModal);
        document.getElementById('restockPartsBtn')?.addEventListener('click', showRestockPartsModal);
        document.getElementById('printPurchaseListBtn')?.addEventListener('click', () => {
            const toPurchase = state.cache.partRequests.filter(pr => pr.status === 'Approved');
            if(toPurchase.length === 0) {
                showTemporaryMessage("No approved requests to print.");
                return;
            }
            let content = `<h1>Parts Purchase List</h1><p>Generated on: ${new Date().toLocaleString()}</p><table><thead><tr><th>Part Name</th><th>Part Number</th><th>Maker</th><th>Quantity</th><th>Purpose</th></tr></thead><tbody>`;
            content += toPurchase.map(pr => {
                const part = state.cache.parts.find(p => p.id === pr.partId);
                return `<tr><td>${pr.newPartName || part?.name || 'N/A'}</td><td>${pr.newPartNumber || part?.sku || 'N/A'}</td><td>${pr.newPartMaker || part?.maker || 'N/A'}</td><td>${pr.quantity}</td><td>${pr.purpose}</td></tr>`;
            }).join('');
            content += '</tbody></table>';
            printReport('Purchase List', content);
        });
    } else if (page === 'locations') {
        document.querySelector('#addDivisionForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addDepartmentForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addSubLineForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addProductionLineForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addCabinetForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addShelfForm')?.addEventListener('submit', handleLocationFormSubmit);
        document.querySelector('#addBoxForm')?.addEventListener('submit', handleLocationFormSubmit);
    }
    
    if (page === 'inventoryReport') {
        const dateRangeSelect = document.getElementById('dateRangeSelect');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        const formatDate = (date) => date.toISOString().split('T')[0];

        dateRangeSelect.addEventListener('change', (e) => {
            const range = e.target.value;
            const today = new Date();
            let start = new Date();
            let end = new Date();

            switch (range) {
                case 'this-week':
                    start.setDate(today.getDate() - today.getDay());
                    break;
                case 'last-7-days':
                    start.setDate(today.getDate() - 6);
                    break;
                case 'this-month':
                    start = new Date(today.getFullYear(), today.getMonth(), 1);
                    break;
                case 'last-30-days':
                    start.setDate(today.getDate() - 29);
                    break;
                case 'last-month':
                    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    end = new Date(today.getFullYear(), today.getMonth(), 0);
                    break;
                case 'custom':
                    startDateInput.readOnly = false;
                    endDateInput.readOnly = false;
                    return;
            }

            startDateInput.value = formatDate(start);
            endDateInput.value = formatDate(end);
            startDateInput.readOnly = true;
            endDateInput.readOnly = true;
        });

        dateRangeSelect.dispatchEvent(new Event('change'));

        document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            
            if (new Date(endDate) <= new Date(startDate)) {
                showTemporaryMessage("The End Date must be at least one day after the Start Date.", true);
                return;

            }

            const container = document.getElementById('reportResultContainer');
            container.innerHTML = '<p>Generating report, please wait...</p>';

            try {
                const reportData = await api.getInventoryReport({ startDate, endDate });
                
                let grandTotalValue = 0;
                let tableHeader = `
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
                            <th class="p-2 text-right">Unit Price</th>
                            <th class="p-2 text-right">Total Value</th>
                        </tr></thead>`;
                
                let tableBody;
                if (reportData.length === 0) {
                    tableBody = '<tbody><tr><td colspan="7" class="text-center p-4">No data for this period.</td></tr></tbody>';
                } else {
                    tableBody = '<tbody>';
                    reportData.forEach(item => {
                        grandTotalValue += item.total_value;
                        tableBody += `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-2">${item.name} (${item.sku})</td>
                                <td class="p-2 text-right">${item.starting_qty}</td>
                                <td class="p-2 text-right text-green-600">+${item.stock_in}</td>
                                <td class="p-2 text-right text-red-600">-${item.stock_out}</td>
                                <td class="p-2 text-right font-bold">${item.ending_qty}</td>
                                <td class="p-2 text-right">RM ${item.price.toFixed(2)}</td>
                                <td class="p-2 text-right">RM ${item.total_value.toFixed(2)}</td>
                            </tr>
                        `;
                    });
                    tableBody += '</tbody>';
                }

                let tableFooter = `
                    <tfoot>
                        <tr class="border-t-2 font-bold">
                            <td class="p-2" colspan="6">Grand Total Value of Stock</td>
                            <td class="p-2 text-right">RM ${grandTotalValue.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>`;
                
                container.innerHTML = tableHeader + tableBody + tableFooter;
                
                document.getElementById('printReportBtn').addEventListener('click', () => {
                    const reportTitle = `Inventory Report for ${startDate} to ${endDate}`;
                    printReport(reportTitle, container.innerHTML);
                });

            } catch (error) {
                container.innerHTML = `<p class="text-red-500">Error generating report: ${error.message}</p>`;
            }
        });
    }
}

// js/app.js

// --- NEW REFRESH FUNCTION ---
async function refreshAllDataAndRender() {
    // Safety Check: Don't refresh if a modal is open (i.e., user is editing)
    const isModalOpen = !!document.querySelector('.modal[style*="display: flex"]');
    if (isModalOpen) {
        console.log("Refresh skipped: a modal is open.");
        return;
    }

    console.log("Refreshing data...");
    showTemporaryMessage("Refreshing data...");
    
    try {
        await loadInitialData(); // Re-fetch all data from the server
        renderMainContent();     // Re-render the current page with the new data
        console.log("Data refreshed successfully.");
    } catch (error) {
        showTemporaryMessage("Failed to refresh data.", true);
    }
}

function attachGlobalEventListeners() {
    // Authentication
    document.getElementById("loginForm").addEventListener("submit", (e) => handleLogin(e, loadAndRender));
    document.getElementById("logoutBtn").addEventListener("click", () => handleLogout(render));
    document.getElementById("createAccountBtn").addEventListener("click", () => {
        document.getElementById("registrationModal").style.display = "flex";
        const divisionSelect = document.getElementById('regDivision');
        const departmentSelect = document.getElementById('regDepartment');
        if(!state.cache.locations || Object.keys(state.cache.locations).length === 0) {
           api.getLocations().then(locations => {
               state.cache.locations = locations;
               populateLocationDropdowns(divisionSelect, departmentSelect);
           });
        } else {
            populateLocationDropdowns(divisionSelect, departmentSelect);
        }
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

    document.body.addEventListener("click", (e) => {
        const target = e.target;
        const button = target.closest("button");

        if (e.target.id === "refreshDataBtn") {
            refreshAllDataAndRender();
        }

        if (target.closest("[data-close-modal]")) {
            target.closest(".modal").style.display = "none";
            return;
        }

        if (target.closest('.calendar-day')?.dataset.date) {
             const date = target.closest('.calendar-day').dataset.date;
             const wosOnDay = state.cache.workOrders.filter(wo => wo.dueDate === date && can.view(wo));
             showCalendarDetailModal(date, wosOnDay);
             return;
        }

        if (!button) return;

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
                // Populate the dropdown before showing the modal
                const partSelect = document.getElementById('requestPartId');
                partSelect.innerHTML = state.cache.parts.filter(can.view).map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('');
                showEditPartRequestModal(req);
            },
            "delete-pr-btn": () => deletePartRequest(id),
            "approve-pr-btn": () => handlePartRequestAction(id, 'Approved'),
            "reject-pr-btn": () => handlePartRequestAction(id, 'Rejected'),
            "delete-location-btn": () => deleteLocation(button.dataset.type, id),
            "addChecklistItemBtn": () => {
                const input = document.getElementById('newChecklistItem');
                if (input.value) { addChecklistItem(input.value); input.value = ''; }
            },
            "remove-checklist-item-btn": () => {
                button.closest('.checklist-item').remove();
            }
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
}

// js/app.js

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