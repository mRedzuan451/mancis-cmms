// js/app.js
import { state, API_URL } from './config.js';
import { api } from './api.js';
import { handleLogin, handleLogout } from './auth.js';
// Import UI functions as needed, or a main render function
import { renderSidebar, renderMainContent } from './ui.js'; 

// Make key functions globally available via a single object if needed for event handlers in HTML
// or for functions calling each other across modules easily.
window.app = {
    loadAndRender,
    render
};

async function loadInitialData() {
    try {
        const [assets, parts, users, workOrders] = await Promise.all([
            api.getAssets(),
            api.getParts(),
            api.getUsers(),
            api.getWorkOrders(),
        ]);
        state.cache.assets = assets;
        state.cache.parts = parts;
        state.cache.users = users;
        state.cache.workOrders = workOrders;
    } catch (error) {
        console.error("Failed to load initial data:", error);
    }
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

async function loadAndRender() {
    await loadInitialData();
    render();
}

function attachGlobalEventListeners() {
    console.log("script.js: Attaching global event listeners...");
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("logoutBtn").addEventListener("click", handleLogout);
    document.getElementById("registrationForm").addEventListener("submit", handleRegistration);
    document.getElementById("editUserForm").addEventListener("submit", handleUserRoleFormSubmit);
    
    document.getElementById("createAccountBtn").addEventListener("click", async () => {
        console.log("script.js: Create Account button clicked.");
        try {
            const locations = await api.getLocations();
            populateLocationDropdowns(
              document.getElementById("regDivision"),
              document.getElementById("regDepartment"),
              locations
            );
            document.getElementById("registrationModal").style.display = "flex";
        } catch (error) {
            showTemporaryMessage("Could not load location data. Please try again.", true);
        }
    });
    
    document.getElementById("sidebar").addEventListener("click", async (e) => {
      const navLink = e.target.closest(".nav-link");
      if (navLink) {
        e.preventDefault();
        state.currentPage = navLink.dataset.page;
        await render();
      }
    });
     document.body.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-modal]")) {
        const modal = e.target.closest(".modal");
        if (modal) {
          modal.style.display = "none";
        }
      }
      if (e.target.id === "addChecklistItemBtn") {
        const input = document.getElementById("newChecklistItem");
        if (input.value.trim()) {
          addChecklistItem(input.value.trim());
          input.value = "";
        }
      }
      if (e.target.closest(".remove-checklist-item-btn")) {
        e.target.closest(".checklist-item").remove();
      }
    });
     document.getElementById("mainContent").addEventListener("click", (e) => {
        handleMainContentClicks(e);
      });
  }
  
  function handleMainContentClicks(e) {
    const target = e.target;
    const button = target.closest("button");
    if (!button) return;
    
    const id = parseInt(button.dataset.id);

    // Asset buttons
    if (button.classList.contains("edit-asset-btn")) showAssetModal(id);
    if (button.classList.contains("delete-asset-btn")) deleteAsset(id);

    // Part buttons
    if (button.classList.contains("edit-part-btn")) showPartModal(id);
    if (button.classList.contains("delete-part-btn")) deletePart(id);

    // Work Order buttons
    if (button.classList.contains("edit-wo-btn")) showWorkOrderModal(id);
    if (button.classList.contains("delete-wo-btn")) deleteWorkOrder(id);

    // User Management buttons
    if (button.classList.contains("edit-user-btn")) showEditUserModal(id);
    if (button.classList.contains("delete-user-btn")) deleteUser(id);

    // Location buttons
    if (button.classList.contains("delete-location-btn")) {
        deleteLocation(button.dataset.type, id);
    }

    // Part Request buttons
    if (button.classList.contains("approve-pr-btn")) handlePartRequestAction(id, 'Approved');
    if (button.classList.contains("reject-pr-btn")) handlePartRequestAction(id, 'Rejected');

    // Calendar buttons
    if (button.id === "prevMonthBtn") {
        state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
        renderMainContent();
    }
    if (button.id === "nextMonthBtn") {
        state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
        renderMainContent();
    }
    const dayEl = target.closest(".calendar-day[data-date]");
    if (dayEl) {
      const date = dayEl.dataset.date;
      const workOrders = state.cache.workOrders.filter((wo) => wo.dueDate === date);
      showCalendarDetailModal(date, workOrders);
    }
  }

  function attachPageSpecificEventListeners(page) {
      switch(page) {
          case 'assets':
              attachAssetPageEventListeners();
              break;
          case 'parts':
              attachPartsPageEventListeners();
              break;
          case 'workOrders':
              attachWorkOrdersPageEventListeners();
              break;
          case 'userManagement':
              attachUserManagementEventListeners();
              break;
          case 'locations':
              attachLocationsPageEventListeners();
              break;
          case 'partRequests':
              attachPartsRequestPageEventListeners();
              break;
          case 'workOrderCalendar':
          case 'activityLog':
              // No specific listeners needed for these pages
              break;
      }
  }

  function attachAssetPageEventListeners() {
    document.getElementById("addAssetBtn")?.addEventListener("click", () => showAssetModal());
    document.getElementById("assetForm")?.addEventListener("submit", handleAssetFormSubmit);
    document.getElementById("assetSearch")?.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const allAssets = state.cache.assets.filter(can.view);
        const filtered = allAssets.filter(
          (a) =>
            a.name.toLowerCase().includes(searchTerm) ||
            a.tag.toLowerCase().includes(searchTerm) ||
            a.category.toLowerCase().includes(searchTerm)
        );
        document.getElementById("assetTableBody").innerHTML =
          generateTableRows("assets", filtered);
      });
  }

  function attachPartsPageEventListeners() {
    document.getElementById("addPartBtn")?.addEventListener("click", () => showPartModal());
    document.getElementById("partForm")?.addEventListener("submit", handlePartFormSubmit);
    document.getElementById("partSearch")?.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const allParts = state.cache.parts.filter(can.view);
        const filtered = allParts.filter(
          (p) =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.sku.toLowerCase().includes(searchTerm) ||
            (p.category && p.category.toLowerCase().includes(searchTerm)) ||
            (p.maker && p.maker.toLowerCase().includes(searchTerm))
        );
        document.getElementById("partTableBody").innerHTML =
          generateTableRows("parts", filtered);
      });
  }

  function attachWorkOrdersPageEventListeners() {
    document.getElementById("addWorkOrderBtn")?.addEventListener("click", () => showWorkOrderModal());
    document.getElementById("workOrderForm")?.addEventListener("submit", handleWorkOrderFormSubmit);
    document.getElementById("workOrderSearch")?.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const allWos = state.cache.workOrders.filter(can.view);
        const filtered = allWos.filter((wo) => {
          const assetName = state.cache.assets.find((a) => a.id === parseInt(wo.assetId))?.name || "";
          return (
            wo.title.toLowerCase().includes(searchTerm) ||
            assetName.toLowerCase().includes(searchTerm)
          );
        });
        document.getElementById("workOrderTableBody").innerHTML =
          generateTableRows("workOrders", filtered);
      });
  }

  function attachUserManagementEventListeners() {
      // The main click handler already manages the delete and edit buttons
  }

  function attachLocationsPageEventListeners() {
      document.getElementById('addDivisionForm')?.addEventListener('submit', (e) => handleLocationFormSubmit(e, 'division'));
      document.getElementById('addDepartmentForm')?.addEventListener('submit', (e) => handleLocationFormSubmit(e, 'department'));
      document.getElementById('addSubLineForm')?.addEventListener('submit', (e) => handleLocationFormSubmit(e, 'subLine'));
      document.getElementById('addProductionLineForm')?.addEventListener('submit', (e) => handleLocationFormSubmit(e, 'productionLine'));
      document.getElementById('addCabinetForm')?.addEventListener('submit', (e) => handleLocationFormSubmit(e, 'cabinet'));
      document.getElementById('addShelfForm')?.addEventListener('submit', (e) => handleLocationFormSubmit(e, 'shelf'));
      document.getElementById('addBoxForm')?.addEventListener('submit', (e) => handleLocationFormSubmit(e, 'box'));
  }

  function attachPartsRequestPageEventListeners() {
      document.getElementById("newPartRequestBtn")?.addEventListener("click", showPartRequestModal);
      document.getElementById("storageRequestBtn")?.addEventListener("click", showStorageRequestModal);
      document.getElementById("receivePartsBtn")?.addEventListener("click", showReceivePartsModal);
      document.getElementById("restockPartsBtn")?.addEventListener("click", showRestockPartsModal);
      document.getElementById("partRequestForm")?.addEventListener("submit", handlePartRequestFormSubmit);
      document.getElementById("storageRequestForm")?.addEventListener("submit", handleStorageRequestFormSubmit);
      document.getElementById("receivePartsForm")?.addEventListener("submit", handleReceivePartsFormSubmit);
      document.getElementById("restockPartsForm")?.addEventListener("submit", handleRestockPartsFormSubmit);
  }
  
  function showAssetModal(assetId = null) {
    const form = document.getElementById("assetForm");
    form.reset();
    document.getElementById("assetId").value = "";

    populateLocationDropdown(
      document.getElementById("assetLocation"),
      "operational"
    );

    if (assetId) {
      const asset = state.cache.assets.find((a) => a.id === assetId);
      if (asset) {
        document.getElementById("assetModalTitle").textContent = "Edit Asset";
        document.getElementById("assetId").value = asset.id;
        document.getElementById("assetName").value = asset.name;
        document.getElementById("assetTag").value = asset.tag;
        document.getElementById("assetCategory").value = asset.category;
        document.getElementById("assetPurchaseDate").value = asset.purchaseDate;
        document.getElementById("assetCost").value = asset.cost;
        document.getElementById("assetCurrency").value = asset.currency;
        document.getElementById("assetLocation").value = asset.locationId;
      }
    } else {
      document.getElementById("assetModalTitle").textContent = "Add Asset";
    }
    document.getElementById("assetModal").style.display = "flex";
  }

  function showPartModal(partId = null) {
    const form = document.getElementById("partForm");
    form.reset();
    document.getElementById("partId").value = "";

    populateLocationDropdown(
      document.getElementById("partLocation"),
      "storage"
    );

    if (partId) {
      const part = state.cache.parts.find((p) => p.id === partId);
      if (part) {
        document.getElementById("partModalTitle").textContent = "Edit Spare Part";
        document.getElementById("partId").value = part.id;
        document.getElementById("partCategory").value = part.category;
        document.getElementById("partName").value = part.name;
        document.getElementById("partMaker").value = part.maker;
        document.getElementById("partSku").value = part.sku;
        document.getElementById("partQuantity").value = part.quantity;
        document.getElementById("partMinQuantity").value = part.minQuantity;
        document.getElementById("partSupplier").value = part.supplier;
        document.getElementById("partPrice").value = part.price;
        document.getElementById("partCurrency").value = part.currency;
        document.getElementById("partLocation").value = part.locationId;
      }
    } else {
      document.getElementById("partModalTitle").textContent = "Add Spare Part";
    }
    document.getElementById("partModal").style.display = "flex";
  }

  function showWorkOrderModal(woId = null) {
    const form = document.getElementById("workOrderForm");
    form.reset();
    document.getElementById("workOrderId").value = "";
    document.getElementById("woChecklistContainer").innerHTML = "";
    document.getElementById("woPartsContainer").innerHTML = "";
    document.getElementById("woPartsSection").style.display = "none";

    const assets = state.cache.assets.filter(can.view);
    document.getElementById("woAsset").innerHTML = '<option value="">Select Asset</option>' + assets
      .map((a) => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    const users = state.cache.users.filter(
        (u) => ["Engineer", "Technician", "Supervisor"].includes(u.role) && can.view(u)
      );
    document.getElementById("woAssignedTo").innerHTML = '<option value="">Assign To</option>' + users
      .map((u) => `<option value="${u.id}">${u.fullName}</option>`)
      .join("");
      
    document.getElementById("addWoPartBtn").onclick = () => addWoPartRow();
    document.getElementById("woTask").onchange = (e) => {
      const task = e.target.value;
      const partsSection = document.getElementById("woPartsSection");
      partsSection.style.display =
        task === "Replacement" || task === "Assemble" ? "block" : "none";
    };

    if (woId) {
      const wo = state.cache.workOrders.find((w) => w.id === woId);
      if (wo) {
        document.getElementById("workOrderModalTitle").textContent = "Edit Work Order";
        document.getElementById("workOrderId").value = wo.id;
        document.getElementById("woTitle").value = wo.title;
        document.getElementById("woDescription").value = wo.description;
        document.getElementById("woAsset").value = wo.assetId;
        document.getElementById("woAssignedTo").value = wo.assignedTo;
        document.getElementById("woTask").value = wo.task;
        document.getElementById("woDueDate").value = wo.dueDate;
        document.getElementById("woBreakdownTime").value = wo.breakdownTimestamp || "";
        document.getElementById("woPriority").value = wo.priority;
        document.getElementById("woFrequency").value = wo.frequency;
        document.getElementById("woStatus").value = wo.status;

        if (wo.checklist && wo.checklist.length > 0) {
          wo.checklist.forEach((item) => addChecklistItem(item.text));
        }
        if (wo.requiredParts && wo.requiredParts.length > 0) {
          document.getElementById("woPartsSection").style.display = "block";
          wo.requiredParts.forEach((part) => addWoPartRow(part.partId, part.quantity));
        }
      }
    } else {
      document.getElementById("workOrderModalTitle").textContent = "Create Work Order";
    }
    document.getElementById("workOrderModal").style.display = "flex";
  }

  function showCalendarDetailModal(date, workOrders) {
    document.getElementById(
      "calendarDetailModalTitle"
    ).textContent = `Work Orders for ${date}`;
    const contentEl = document.getElementById("calendarDetailContent");

    if (workOrders.length === 0) {
      contentEl.innerHTML =
        "<p>No work orders scheduled for this day.</p>";
    } else {
      contentEl.innerHTML = workOrders
        .map((wo) => {
          const asset = state.cache.assets.find((a) => a.id === parseInt(wo.assetId));
          return `
              <div class="p-3 border rounded-lg hover:bg-gray-50">
                  <p class="font-bold">${wo.title}</p>
                  <p class="text-sm"><strong>Asset:</strong> ${
                    asset ? asset.name : "N/A"
                  }</p>
                  <p class="text-sm"><strong>Status:</strong> ${
                    wo.status
                  }</p>
                  <p class="text-sm"><strong>Priority:</strong> ${
                    wo.priority
                  }</p>
              </div>
          `;
        })
        .join("");
    }

    document.getElementById("calendarDetailModal").style.display = "flex";
  }

  function showEditUserModal(userId) {
    const user = state.cache.users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById("editUserId").value = user.id;
    document.getElementById("editUserFullName").textContent = user.fullName;
    document.getElementById("editUserRole").value = user.role;
    document.getElementById("editUserModal").style.display = "flex";
  }

  function addChecklistItem(text) {
    const container = document.getElementById("woChecklistContainer");
    const itemDiv = document.createElement("div");
    itemDiv.className = "flex items-center gap-2 checklist-item";
    itemDiv.innerHTML = `
      <span class="flex-grow p-2 bg-gray-100 rounded">${text}</span>
      <button type="button" class="remove-checklist-item-btn text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
  `;
    container.appendChild(itemDiv);
  }

  function addWoPartRow(selectedPartId = "", quantity = 1) {
    const container = document.getElementById("woPartsContainer");
    const allParts = state.cache.parts;

    const row = document.createElement("div");
    row.className = "flex items-center gap-2 wo-part-row mt-2";

    const select = document.createElement("select");
    select.className = "w-2/3 px-3 py-2 border rounded wo-part-select";
    select.innerHTML =
      '<option value="">Select a part...</option>' +
      allParts
        .map(
          (p) =>
            `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`
        )
        .join("");
    select.value = selectedPartId;

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.className = "w-1/3 px-3 py-2 border rounded wo-part-qty";
    qtyInput.value = quantity;
    qtyInput.min = 1;
    qtyInput.placeholder = "Qty";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "remove-wo-part-btn text-red-500 hover:text-red-700";
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    removeBtn.onclick = () => row.remove();

    row.appendChild(select);
    row.appendChild(qtyInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  function populateLocationDropdowns(divisionSelect, departmentSelect, locations) {
    const { divisions = [], departments = [] } = locations || state.cache.locations || {};
    divisionSelect.innerHTML =
      `<option value="">Select Division</option>` +
      divisions
        .map((d) => `<option value="${d.id}">${d.name}</option>`)
        .join("");
    departmentSelect.innerHTML = `<option value="">Select Department</option>`;

    divisionSelect.addEventListener("change", () => {
      const selectedDivisionId = parseInt(divisionSelect.value);
      const filteredDepartments = departments.filter(
        (d) => d.divisionId === selectedDivisionId
      );
      departmentSelect.innerHTML =
        `<option value="">Select Department</option>` +
        filteredDepartments
          .map((d) => `<option value="${d.id}">${d.name}</option>`)
          .join("");
    });
  }

  function populateLocationDropdown(selectElement, type = "all") {
    const {
      productionLines = [],
      cabinets = [],
      shelves = [],
      boxes = [],
    } = state.cache.locations || {};
    let options = '<option value="">Select a location</option>';

    if (type === "all" || type === "operational") {
      const filteredOpLocations = (
        state.currentUser.role === "Admin"
          ? productionLines
          : productionLines.filter((loc) => {
              const { subLines = [] } = state.cache.locations || {};
              const subLine = subLines.find(
                (sl) => sl.id === loc.subLineId
              );
              return (
                subLine &&
                subLine.departmentId === state.currentUser.departmentId
              );
            })
      )
        .map(
          (loc) =>
            `<option value="pl-${loc.id}">${getFullLocationName(
              `pl-${loc.id}`
            )}</option>`
        )
        .join("");

      if (filteredOpLocations) {
        options += `<optgroup label="Production Lines">${filteredOpLocations}</optgroup>`;
      }
    }
    if (type === "all" || type === "storage") {
      const filteredStorageLocations = (
        state.currentUser.role === "Admin"
          ? boxes
          : boxes.filter((box) => {
              const shelf = state.cache.locations.shelves.find((s) => s.id === box.shelfId);
              const cabinet = shelf ? state.cache.locations.cabinets.find((c) => c.id === shelf.cabinetId) : null;
              return cabinet && cabinet.departmentId === state.currentUser.departmentId;
            })
      )
        .map(
          (loc) =>
            `<option value="box-${loc.id}">${getFullLocationName(
              `box-${loc.id}`
            )}</option>`
        )
        .join("");

      if (filteredStorageLocations) {
        options += `<optgroup label="Storage Boxes">${filteredStorageLocations}</optgroup>`;
      }
    }
    selectElement.innerHTML = options;
  }

// --- APPLICATION INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    console.log("App initialized.");
    attachGlobalEventListeners();
    render(); // Initial render for the login screen
});