// js/ui.js

import { state } from './config.js';
import { can } from './auth.js';
import { getFullLocationName, getUserDepartment } from './utils.js';

// Each function that creates a page view is now exported.

export function renderDashboard() {
  const assets = state.cache.assets.filter(can.view);
  const workOrders = state.cache.workOrders.filter(can.view);
  const parts = state.cache.parts.filter(can.view);
  const partRequests = state.cache.partRequests.filter(can.view);
  
  const openWOs = workOrders.filter((wo) => wo.status === "Open").length;
  const pendingRequests = partRequests.filter((pr) => pr.status === "Requested").length;
  const lowStockItems = parts.filter((p) => parseInt(p.quantity) <= parseInt(p.minQuantity)).length;
  const highPriorityWOs = workOrders.filter((wo) => wo.priority === "High" && wo.status === "Open");

  return `
    <h1 class="text-3xl font-bold mb-6">Dashboard</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow"><h3 class="text-gray-500">Total Assets</h3><p class="text-3xl font-bold">${assets.length}</p></div>
        <div class="bg-white p-6 rounded-lg shadow"><h3 class="text-gray-500">Open Work Orders</h3><p class="text-3xl font-bold">${openWOs}</p></div>
        <div class="bg-white p-6 rounded-lg shadow"><h3 class="text-gray-500">Pending Part Requests</h3><p class="text-3xl font-bold">${pendingRequests}</p></div>
        <div class="bg-white p-6 rounded-lg shadow"><h3 class="text-gray-500">Low Stock Items</h3><p class="text-3xl font-bold">${lowStockItems}</p></div>
    </div>
    <h2 class="text-2xl font-bold mb-4">High Priority Work Orders</h2>
    <div class="bg-white p-4 rounded-lg shadow">
        ${highPriorityWOs.length > 0 ? `
            <table class="w-full">
                <thead><tr class="border-b"><th class="text-left p-2">Title</th><th class="text-left p-2">Asset</th><th class="text-left p-2">Due Date</th></tr></thead>
                <tbody>
                    ${highPriorityWOs.map((wo) => `<tr class="border-b hover:bg-gray-50"><td class="p-2">${wo.title}</td><td class="p-2">${state.cache.assets.find((a) => a.id === parseInt(wo.assetId))?.name || "N/A"}</td><td class="p-2">${wo.dueDate}</td></tr>`).join("")}
                </tbody>
            </table>`
          : `<p class="text-gray-500">No high priority work orders.</p>`
        }
    </div>`;
}

export function renderAssetsPage() {
    const assets = state.cache.assets.filter(can.view);
    return `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">Asset Management</h1>
          <div><button id="addAssetBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Add Asset</button></div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
          <input type="text" id="assetSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by name, tag, or category...">
          <div class="overflow-x-auto">
              <table class="w-full" id="assetTable">
                  <thead><tr class="border-b">
                      <th class="p-2 text-left cursor-pointer" data-sort="name">Name <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="tag">Tag <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="locationId">Location <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="status">Status <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left">Actions</th>
                  </tr></thead>
                  <tbody id="assetTableBody">${generateTableRows("assets", assets)}</tbody>
              </table>
          </div>
      </div>`;
}

export function renderPartsPage() {
    // ... Function content from original script.js ...
}

export function renderWorkOrdersPage() {
    // ... Function content from original script.js ...
}

export function renderUserManagementPage() {
    // ... Function content from original script.js ...
}

export function renderWorkOrderCalendar() {
    // ... Function content from original script.js ...
}

export function renderLocationsPage() {
    // ... Function content from original script.js ...
}

export function renderActivityLogPage() {
    // ... Function content from original script.js ...
}

export function renderPartsRequestPage() {
    // ... Function content from original script.js ...
}


export function generateTableRows(type, data) {
    if (!data || data.length === 0) {
      return `<tr><td colspan="10" class="text-center p-4 text-gray-500">No data available.</td></tr>`;
    }

    data.sort((a, b) => {
      let valA = a[state.sortKey];
      let valB = b[state.sortKey];
      if (state.sortKey === "locationId") {
        valA = getFullLocationName(a.locationId);
        valB = getFullLocationName(b.locationId);
      }
      if (state.sortKey === "assetId") {
        valA = state.cache.assets.find((asset) => asset.id === parseInt(a.assetId))?.name || "";
        valB = state.cache.assets.find((asset) => asset.id === parseInt(b.assetId))?.name || "";
      }
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return state.sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return state.sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    
    switch (type) {
        // ... ALL CASES from your original generateTableRows function
        // For example:
        case "assets":
            return data.map(asset => ``).join('');
        case "parts":
            return data.map(part => ``).join('');
        default:
            return '';
    }
}

export function renderSidebar() {
    const { fullName, role } = state.currentUser;
    document.getElementById("userFullName").textContent = fullName;
    document.getElementById("userRole").textContent = role;
    document.getElementById("userDepartment").textContent = getUserDepartment(state.currentUser);
    const navLinks = [
        { page: "dashboard", icon: "fa-tachometer-alt", text: "Dashboard", roles: ["Admin", "Manager", "Supervisor", "Engineer", "Technician", "Clerk"] },
        { page: "assets", icon: "fa-box", text: "Assets", roles: ["Admin", "Manager", "Supervisor", "Engineer", "Technician"] },
        { page: "parts", icon: "fa-cogs", text: "Spare Parts", roles: ["Admin", "Manager", "Supervisor", "Engineer", "Technician"] },
        { page: "partRequests", icon: "fa-inbox", text: "Part Requests", roles: ["Admin", "Manager", "Supervisor", "Engineer", "Technician", "Clerk"] },
        { page: "workOrders", icon: "fa-clipboard-list", text: "Work Orders", roles: ["Admin", "Manager", "Supervisor", "Engineer", "Technician"] },
        { page: "workOrderCalendar", icon: "fa-calendar-alt", text: "Calendar", roles: ["Admin", "Manager", "Supervisor", "Engineer", "Technician"] },
        { page: "locations", icon: "fa-map-marker-alt", text: "Locations", roles: ["Admin", "Manager", "Supervisor"] },
        { page: "userManagement", icon: "fa-users-cog", text: "User Management", roles: ["Admin"] },
        { page: "activityLog", icon: "fa-history", text: "Activity Log", roles: ["Admin"] },
    ];
    const navMenu = document.getElementById("navMenu");
    navMenu.innerHTML = navLinks
        .filter((link) => link.roles.includes(state.currentUser.role))
        .map(link => `<a href="#" class="nav-link flex items-center p-2 rounded-lg hover:bg-gray-700 ${state.currentPage === link.page ? "bg-gray-900" : ""}" data-page="${link.page}"><i class="fas ${link.icon} w-6 text-center"></i><span class="ml-3">${link.text}</span></a>`)
        .join("");
}

export function showAssetModal(assetId = null) { /* ... */ }
export function showPartModal(partId = null) { /* ... */ }
// ... Export all other show...Modal and helper functions