// js/ui.js

import { state } from './config.js';
import { can } from './auth.js';
import { api } from './api.js'; // <-- ADD THIS LINE
import { getFullLocationName, getUserDepartment, showTemporaryMessage, calculateNextPmDate } from './utils.js';

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

// js/ui.js

export function renderAssetsPage() {
    const assets = state.cache.assets.filter(can.view);

    // Use the new helper function to create the header
    const header = renderPageHeader("Asset Management", [
        // Add the new Refresh button here
        '<button id="refreshDataBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-sync-alt mr-2"></i>Refresh</button>',
        '<button id="printAssetListBtn" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-print mr-2"></i>Print List</button>',
        '<button id="addAssetBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Add Asset</button>'
    ]);

    return `
      ${header}
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
    const parts = state.cache.parts.filter(can.view);
    
    const header = renderPageHeader("Spare Parts Management", [
        '<button id="refreshDataBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-sync-alt mr-2"></i>Refresh</button>',
        '<button id="printPartListBtn" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-print mr-2"></i>Print List</button>',
        '<button id="addPartBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Add Part</button>'
    ]);
    
    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
          <input type="text" id="partSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by name, SKU, category, or maker...">
          <div class="overflow-x-auto">
              <table class="w-full" id="partTable">
                  <thead><tr class="border-b">
                      <th class="p-2 text-left cursor-pointer" data-sort="name">Part Name <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="sku">SKU <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="category">Category <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="supplier">Supplier <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="quantity">Quantity <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="price">Price <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left">Actions</th>
                  </tr></thead>
                  <tbody id="partTableBody">
                      ${generateTableRows("parts", parts)}
                  </tbody>
              </table>
          </div>
      </div>
  `;
}

export function renderWorkOrdersPage() {
    // Note: We now pass the full, unfiltered list to generateTableRows
    const workOrders = state.cache.workOrders.filter(can.view);

    const header = renderPageHeader("Work Order Management", [
        '<button id="addWorkOrderBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Create Corrective WO</button>'
    ]);

    return `
      ${header}
      
      <div class="mb-4 border-b border-gray-200">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
              <button class="wo-type-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-600 border-blue-500" data-type="All">All Work Orders</button>
              <button class="wo-type-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300" data-type="CM">Corrective (CM)</button>
              <button class="wo-type-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300" data-type="PM">Preventive (PM)</button>
          </nav>
      </div>

      <div class="bg-white p-4 rounded-lg shadow">
          <input type="text" id="workOrderSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by title or asset name...">
          <div class="overflow-x-auto">
              <table class="w-full" id="workOrderTable">
                  <thead><tr class="border-b">
                      <th class="p-2 text-left cursor-pointer" data-sort="title">Title <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="wo_type">Type <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="assetId">Asset <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="start_date">Start Date <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="dueDate">Due Date <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="status">Status <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left">Actions</th>
                  </tr></thead>
                  <tbody id="workOrderTableBody">
                      ${generateTableRows("workOrders", workOrders)}
                  </tbody>
              </table>
          </div>
      </div>
  `;
}

export function renderUserManagementPage() {
    const users = state.cache.users;
    const header = renderPageHeader("User Management", [
        '<button id="refreshDataBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-sync-alt mr-2"></i>Refresh</button>'
    ]);

    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
          <div class="overflow-x-auto">
              <table class="w-full" id="userTable">
                  <thead><tr class="border-b">
                      <th class="p-2 text-left">Full Name</th>
                      <th class="p-2 text-left">Username</th>
                      <th class="p-2 text-left">Role</th>
                      <th class="p-2 text-left">Department</th>
                      <th class="p-2 text-left">Actions</th>
                  </tr></thead>
                  <tbody>
                      ${generateTableRows("users", users)}
                  </tbody>
              </table>
          </div>
      </div>
  `;
}

export function renderWorkOrderCalendar() {
    const { calendarDate } = state;
    const month = calendarDate.getMonth();
    const year = calendarDate.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const workOrders = state.cache.workOrders.filter(can.view);
    let calendarHtml = `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">Work Order Calendar</h1>
          <div class="flex items-center space-x-2">
              <button id="prevMonthBtn" class="px-3 py-1 bg-gray-200 rounded">&lt;</button>
              <h2 class="text-xl font-semibold">${calendarDate.toLocaleString("default",{ month: "long", year: "numeric" })}</h2>
              <button id="nextMonthBtn" class="px-3 py-1 bg-gray-200 rounded">&gt;</button>
          </div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
          <div class="calendar-grid">
              <div class="text-center font-bold p-2 calendar-day-header">Sun</div>
              <div class="text-center font-bold p-2 calendar-day-header">Mon</div>
              <div class="text-center font-bold p-2 calendar-day-header">Tue</div>
              <div class="text-center font-bold p-2 calendar-day-header">Wed</div>
              <div class="text-center font-bold p-2 calendar-day-header">Thu</div>
              <div class="text-center font-bold p-2 calendar-day-header">Fri</div>
              <div class="text-center font-bold p-2 calendar-day-header">Sat</div>`;
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarHtml += `<div class="calendar-day other-month"></div>`;
    }
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const isToday = today.toDateString() === currentDate.toDateString();
        const dateStr = currentDate.toISOString().split("T")[0];
        const wosOnThisDay = workOrders.filter((wo) => wo.dueDate === dateStr);
        const hasEvents = wosOnThisDay.length > 0;
        calendarHtml += `
          <div class="calendar-day p-2 ${isToday ? "today" : ""} ${hasEvents ? "cursor-pointer hover:bg-blue-100" : ""}" ${hasEvents ? `data-date="${dateStr}"` : ""}>
              <div class="font-bold">${day}</div>
              <div class="mt-1 space-y-1 overflow-y-auto max-h-20 pointer-events-none">
              ${wosOnThisDay.map((wo) => {
                    const priorityColor = { High: "bg-red-100", Medium: "bg-yellow-100", Low: "bg-blue-100" }[wo.priority];
                    let statusDotColor = "bg-gray-400";
                    if (wo.status === "Completed") statusDotColor = "bg-green-500";
                    else if (wo.status === "Delay") statusDotColor = "bg-red-500";
                    else if (["Open", "In Progress", "On Hold"].includes(wo.status)) statusDotColor = "bg-yellow-500";
                    return `<div class="text-xs p-1 rounded ${priorityColor} flex items-center" title="${wo.title} - Status: ${wo.status}"><span class="inline-block w-2 h-2 ${statusDotColor} rounded-full mr-1.5 flex-shrink-0"></span><span class="truncate">${wo.title}</span></div>`;
                }).join("")}
              </div>
          </div>`;
    }
    const lastDayOfMonth = new Date(year, month, daysInMonth).getDay();
    for (let i = lastDayOfMonth; i < 6; i++) {
        calendarHtml += `<div class="calendar-day other-month"></div>`;
    }
    calendarHtml += `</div></div>`;
    return calendarHtml;
}

export function renderLocationsPage() {
    const { divisions = [], departments = [], subLines = [], productionLines = [], cabinets = [], shelves = [], boxes = [] } = state.cache.locations || {};
    const isAdmin = state.currentUser.role === "Admin";

    return `
      <h1 class="text-3xl font-bold mb-6">Location Management</h1>
      <div class="grid grid-cols-1 ${isAdmin ? "md:grid-cols-3" : ""} gap-6">
          ${isAdmin ? `
          <div class="bg-white p-4 rounded-lg shadow space-y-6">
              <div>
                  <h2 class="text-xl font-bold mb-4">Divisions</h2>
                  <ul id="divisionList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${divisions.map((d) => `<li class="flex justify-between items-center p-2 bg-gray-50 rounded"><span>${d.name}</span><button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${d.id}" data-type="division"><i class="fas fa-trash"></i></button></li>`).join("") || '<li class="text-gray-500">No divisions found.</li>'}
                  </ul>
                  <form id="addDivisionForm" class="flex gap-2 border-t pt-4"><input type="text" id="newDivisionName" class="flex-grow px-2 py-1 border rounded" placeholder="New Division Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></form>
              </div>
              <div>
                  <h2 class="text-xl font-bold mb-4">Departments</h2>
                  <ul id="departmentList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${departments.map((d) => `<li class="flex justify-between items-center p-2 bg-gray-50 rounded"><div><p>${d.name}</p><p class="text-xs text-gray-500">${divisions.find(div => div.id === d.divisionId)?.name || "No Division"}</p></div><button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${d.id}" data-type="department"><i class="fas fa-trash"></i></button></li>`).join("") || '<li class="text-gray-500">No departments found.</li>'}
                  </ul>
                  <form id="addDepartmentForm" class="border-t pt-4">
                      <select id="departmentDivisionSelect" class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Division</option>${divisions.map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}</select>
                      <div class="flex gap-2"><input type="text" id="newDepartmentName" class="flex-grow px-2 py-1 border rounded" placeholder="New Department Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div>
                  </form>
              </div>
              <div>
                  <h2 class="text-xl font-bold mb-4">Sub Lines</h2>
                  <ul id="subLineList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${subLines.map((sl) => `<li class="flex justify-between items-center p-2 bg-gray-50 rounded"><div><p>${sl.name}</p><p class="text-xs text-gray-500">${departments.find(d => d.id === sl.departmentId)?.name || "No Department"}</p></div><button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${sl.id}" data-type="subLine"><i class="fas fa-trash"></i></button></li>`).join("") || '<li class="text-gray-500">No sub lines found.</li>'}
                  </ul>
                  <form id="addSubLineForm" class="border-t pt-4">
                      <select id="subLineDepartmentSelect" class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Department</option>${departments.map((d) => `<option value="${d.id}">${divisions.find(div => div.id === d.divisionId)?.name || ''} > ${d.name}</option>`).join("")}</select>
                      <div class="flex gap-2"><input type="text" id="newSubLineName" class="flex-grow px-2 py-1 border rounded" placeholder="New Sub Line Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div>
                  </form>
              </div>
          </div>
          <div class="bg-white p-4 rounded-lg shadow">
              <h2 class="text-xl font-bold mb-4">Production Lines</h2>
              <ul id="productionLineList" class="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  ${productionLines.map((pl) => `<li class="flex justify-between items-center p-2 bg-gray-50 rounded"><div><p>${pl.name}</p><p class="text-xs text-gray-500">${subLines.find(sl => sl.id === pl.subLineId)?.name || "No Sub Line"}</p></div><button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${pl.id}" data-type="productionLine"><i class="fas fa-trash"></i></button></li>`).join("") || '<li class="text-gray-500">No production lines found.</li>'}
              </ul>
              <form id="addProductionLineForm" class="border-t pt-4">
                  <h3 class="font-semibold mb-2">Add New Production Line</h3>
                  <select id="productionLineSubLineSelect" class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Sub Line</option>${subLines.map((sl) => `<option value="${sl.id}">${getFullLocationName(`sl-${sl.id}`)}</option>`).join("")}</select>
                  <div class="flex gap-2"><input type="text" id="newProductionLineName" class="flex-grow px-2 py-1 border rounded" placeholder="New Line Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div>
              </form>
          </div>` : ""}
          <div class="bg-white p-4 rounded-lg shadow space-y-4">
              <h2 class="text-xl font-bold mb-2">Storage Locations</h2>
               <div>
                  <h3 class="font-semibold mb-2">Cabinets</h3>
                   <ul id="cabinetList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${cabinets.map((c) => `<li class="flex justify-between items-center p-2 bg-gray-50 rounded"><span>${c.name} <span class="text-xs text-gray-500">(${departments.find(d => d.id === c.departmentId)?.name || "N/A"})</span></span><button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${c.id}" data-type="cabinet"><i class="fas fa-trash"></i></button></li>`).join("") || '<li class="text-gray-500">No cabinets found.</li>'}
                  </ul>
                  <form id="addCabinetForm" class="border-t pt-2">
                      <select id="cabinetDepartmentSelect" class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Department</option>${departments.map((d) => `<option value="${d.id}">${divisions.find(div => div.id === d.divisionId)?.name || ''} > ${d.name}</option>`).join("")}</select>
                      <div class="flex gap-2"><input type="text" id="newCabinetName" class="flex-grow px-2 py-1 border rounded" placeholder="New Cabinet Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div>
                  </form>
              </div>
               <div>
                  <h3 class="font-semibold mb-2">Shelves</h3>
                   <ul id="shelfList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${shelves.map((s) => `<li class="flex justify-between items-center p-2 bg-gray-50 rounded"><span>${s.name} <span class="text-xs text-gray-500">(${cabinets.find(c => c.id === s.cabinetId)?.name || "N/A"})</span></span><button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${s.id}" data-type="shelf"><i class="fas fa-trash"></i></button></li>`).join("") || '<li class="text-gray-500">No shelves found.</li>'}
                  </ul>
                  <form id="addShelfForm" class="border-t pt-2">
                      <select id="shelfCabinetSelect" class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Cabinet</option>${cabinets.map((c) => `<option value="${c.id}">${getFullLocationName(`cab-${c.id}`)}</option>`).join("")}</select>
                      <div class="flex gap-2"><input type="text" id="newShelfName" class="flex-grow px-2 py-1 border rounded" placeholder="New Shelf Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div>
                  </form>
              </div>
               <div>
                  <h3 class="font-semibold mb-2">Boxes</h3>
                   <ul id="boxList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${boxes.map((b) => `<li class="flex justify-between items-center p-2 bg-gray-50 rounded"><span>${b.name} <span class="text-xs text-gray-500">(${shelves.find(s => s.id === b.shelfId)?.name || "N/A"})</span></span><button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${b.id}" data-type="box"><i class="fas fa-trash"></i></button></li>`).join("") || '<li class="text-gray-500">No boxes found.</li>'}
                  </ul>
                  <form id="addBoxForm" class="border-t pt-2">
                      <select id="boxShelfSelect" class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Shelf</option>${shelves.map((s) => `<option value="${s.id}">${getFullLocationName(`sh-${s.id}`)}</option>`).join("")}</select>
                      <div class="flex gap-2"><input type="text" id="newBoxName" class="flex-grow px-2 py-1 border rounded" placeholder="New Box Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div>
                  </form>
              </div>
          </div>
      </div>`;
}

export function renderActivityLogPage() {
    const logs = state.cache.logs;
    const header = renderPageHeader("Activity Log", [
        '<button id="refreshDataBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-sync-alt mr-2"></i>Refresh</button>'
    ]);

    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
          <ul class="space-y-4">
              ${logs.map((log) => `
                  <li class="border-b pb-2">
                      <p class="font-semibold">${log.action} <span class="font-normal text-gray-600">by ${log.user}</span></p>
                      <p class="text-sm text-gray-500">${new Date(log.timestamp).toLocaleString()}</p>
                      ${log.details ? `<p class="text-sm mt-1 text-gray-700">${log.details}</p>` : ""}
                  </li>`).join("")}
          </ul>
      </div>`;
}

// js/ui.js

export function renderPartsRequestPage() {
    // This line gets the data from the cache.
    const partRequests = state.cache.partRequests;

    // This block builds the header and buttons.
    const header = renderPageHeader("Part Requests", [
        '<button id="refreshDataBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-sync-alt mr-2"></i>Refresh</button>',
        '<button id="printPurchaseListBtn" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-file-invoice mr-2"></i>Print Purchase List</button>',
        '<button id="storageRequestBtn" class="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-warehouse mr-2"></i>Request from Storage</button>',
        '<button id="newPartRequestBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>New Purchase Request</button>',
        '<button id="receivePartsBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-box-open mr-2"></i>Receive Parts</button>',
        '<button id="restockPartsBtn" class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-dolly-flatbed mr-2"></i>Restock Parts</button>'
    ]);

    // This is the corrected return statement.
    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
          <div class="overflow-x-auto">
              <table class="w-full">
                  <thead><tr class="border-b">
                      <th class="p-2 text-left">Part Name</th>
                      <th class="p-2 text-left">Quantity</th>
                      <th class="p-2 text-left">Status</th>
                      <th class="p-2 text-left">Purpose / Reason</th>
                      <th class="p-2 text-left">Actions</th>
                  </tr></thead>
                  
                  <tbody>
                      ${generateTableRows("partRequests", partRequests)}
                  </tbody>

              </table>
          </div>
      </div>`;
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
      } else if (state.sortKey === "assetId") {
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
      case "assets":
        return data.map((asset) => `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${asset.name}</td>
                  <td class="p-2">${asset.tag}</td>
                  <td class="p-2">${getFullLocationName(asset.locationId)}</td>
                  <td class="p-2"><span class="px-2 py-1 text-xs font-semibold rounded-full ${asset.status === "Active" ? "bg-green-200 text-green-800" : asset.status === "Decommissioned" ? "bg-gray-200 text-gray-800" : "bg-yellow-200 text-yellow-800"}">${asset.status}</span></td>
                  <td class="p-2 space-x-2">
                      <button class="view-asset-btn text-blue-500 hover:text-blue-700" data-id="${asset.id}" title="View Details"><i class="fas fa-eye"></i></button>
                      <button class="edit-asset-btn text-yellow-500 hover:text-yellow-700" data-id="${asset.id}" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="transfer-asset-btn text-purple-500 hover:text-purple-700" data-id="${asset.id}" title="Transfer"><i class="fas fa-truck"></i></button>
                      <button class="delete-asset-btn text-red-500 hover:text-red-700" data-id="${asset.id}" title="Delete"><i class="fas fa-trash"></i></button>
                      ${asset.status !== "Decommissioned" ? `<button class="dispose-asset-btn text-gray-500 hover:text-gray-700" data-id="${asset.id}" title="Dispose"><i class="fas fa-ban"></i></button>` : ""}
                  </td>
              </tr>`).join("");
      case "parts":
        return data.map((part) => `
              <tr class="border-b hover:bg-gray-50 ${parseInt(part.quantity) <= parseInt(part.minQuantity) ? "bg-red-100" : ""}">
                  <td class="p-2">${part.name}</td>
                  <td class="p-2">${part.sku}</td>
                  <td class="p-2">${part.category || "N/A"}</td>
                  <td class="p-2">${part.supplier || "N/A"}</td>
                  <td class="p-2">${part.quantity} ${parseInt(part.quantity) <= parseInt(part.minQuantity) ? '<span class="text-red-600 font-bold">(Low)</span>' : ""}</td>
                  <td class="p-2">${part.price ? `${part.currency || ""} ${parseFloat(part.price).toFixed(2)}` : "N/A"}</td>
                  <td class="p-2 space-x-2">
                      <button class="view-part-btn text-blue-500 hover:text-blue-700" data-id="${part.id}" title="View Details"><i class="fas fa-eye"></i></button>
                      <button class="edit-part-btn text-yellow-500 hover:text-yellow-700" data-id="${part.id}" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="delete-part-btn text-red-500 hover:text-red-700" data-id="${part.id}"><i class="fas fa-trash"></i></button>
                  </td>
              </tr>`).join("");
      case "workOrders":
        const woStatusColors = { Open: "bg-blue-200 text-blue-800", "In Progress": "bg-yellow-200 text-yellow-800", "On Hold": "bg-orange-200 text-orange-800", Delay: "bg-red-200 text-red-800", Completed: "bg-green-200 text-green-800" };
        return data.map((wo) => {
            const assetName = state.cache.assets.find((a) => a.id === parseInt(wo.assetId))?.name || "N/A";
            const statusColorClass = woStatusColors[wo.status] || "bg-gray-200 text-gray-800";
            return `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${wo.title}</td>
                  <td class="p-2"><span class="font-mono px-2 py-1 text-xs rounded bg-gray-100">${wo.wo_type}</span></td>
                  <td class="p-2">${assetName}</td>
                  <td class="p-2">${wo.start_date || 'N/A'}</td>
                  <td class="p-2">${wo.dueDate}</td>
                  <td class="p-2"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}">${wo.status}</span></td>
                  <td class="p-2 space-x-2 whitespace-nowrap">
                      <button class="view-wo-btn text-blue-500 hover:text-blue-700" data-id="${wo.id}" title="View Details"><i class="fas fa-eye"></i></button>
                      ${wo.status !== 'Completed' ? `
                          <button class="edit-wo-btn text-yellow-500 hover:text-yellow-700" data-id="${wo.id}" title="Edit"><i class="fas fa-edit"></i></button>
                          <button class="complete-wo-btn text-green-500 hover:text-green-700" data-id="${wo.id}" title="Complete"><i class="fas fa-check-circle"></i></button>
                      ` : ''}
                      ${state.currentUser.role === 'Admin' ? `
                          <button class="delete-wo-btn text-red-500 hover:text-red-700" data-id="${wo.id}" title="Delete"><i class="fas fa-trash"></i></button>
                      ` : ''}
                  </td>
              </tr>`;
          }).join("");
      case "users":
        // Only show the edit and delete buttons if the current user is an Admin
        const showAdminActions = state.currentUser.role === 'Admin';
        return data.map((user) => `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${user.fullName}</td>
                  <td class="p-2">${user.username}</td>
                  <td class="p-2">${user.role}</td>
                  <td class="p-2">${getUserDepartment(user)}</td>
                  <td class="p-2 space-x-2">
                      ${showAdminActions && user.id !== 1 ? `
                          <button class="edit-user-btn text-yellow-500 hover:text-yellow-700" data-id="${user.id}" title="Edit Role"><i class="fas fa-user-shield"></i></button>
                      ` : ''}
                      ${showAdminActions && user.id !== state.currentUser.id && user.id !== 1 ? `
                          <button class="delete-user-btn text-red-500 hover:text-red-700" data-id="${user.id}" title="Delete User"><i class="fas fa-trash"></i></button>
                      ` : ""}
                  </td>
              </tr>`).join("");
      // js/ui.js --> inside generateTableRows()

      case "partRequests":
        // This object maps a status name to a set of Tailwind CSS color classes.
        const prStatusColors = { 
            "Requested": "bg-blue-200 text-blue-800", 
            "Requested from Storage": "bg-cyan-200 text-cyan-800", 
            "Approved": "bg-yellow-200 text-yellow-800", 
            "Rejected": "bg-red-200 text-red-800", 
            "Received": "bg-green-200 text-green-800", 
            "Completed": "bg-gray-400 text-gray-800" 
        };

        return data.map((req) => {
            const part = req.partId ? state.cache.parts.find((p) => p.id === req.partId) : null;
            const partName = part ? part.name : `<span class="italic text-gray-500">${req.newPartName} (New)</span>`;
            
            // Look up the correct color class, or use a default gray if not found.
            const statusColorClass = prStatusColors[req.status] || "bg-gray-200 text-gray-800";
            
            const notesOrReason = req.status === 'Rejected' 
                ? `<span class="text-red-600">${req.rejectionReason || 'No reason provided.'}</span>` 
                : req.purpose;
            
            const canEdit = req.requesterId === state.currentUser.id && req.status === 'Requested';
            const canDelete = ['Admin', 'Manager'].includes(state.currentUser.role);
            const canApprove = (state.currentUser.role === "Admin" || state.currentUser.role === "Manager") && (req.status === "Requested" || req.status === "Requested from Storage");

            return `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${partName}</td>
                  <td class="p-2">${req.quantity}</td>
                  
                  <td class="p-2"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}">${req.status}</span></td>
                  
                  <td class="p-2 text-sm">${notesOrReason}</td>
                  <td class="p-2 space-x-2 whitespace-nowrap">
                      <button class="view-pr-btn text-blue-500 hover:text-blue-700" data-id="${req.id}" title="View Details"><i class="fas fa-eye"></i></button>
                      ${canEdit ? `<button class="edit-pr-btn text-yellow-500 hover:text-yellow-700" data-id="${req.id}" title="Edit"><i class="fas fa-edit"></i></button>` : ""}
                      ${canApprove ? `<button class="approve-pr-btn text-green-500 hover:text-green-700" data-id="${req.id}" title="Approve"><i class="fas fa-check"></i></button><button class="reject-pr-btn text-red-500 hover:text-red-700" data-id="${req.id}" title="Reject"><i class="fas fa-times"></i></button>` : ""}
                      ${canDelete ? `<button class="delete-pr-btn text-red-500 hover:text-red-700" data-id="${req.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ""}
                  </td>
              </tr>`;
          }).join("");
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
        { page: "pmSchedules", icon: "fa-calendar-check", text: "PM Schedules", roles: ["Admin", "Manager", "Supervisor"] },
        { page: "workOrderCalendar", icon: "fa-calendar-alt", text: "Calendar", roles: ["Admin", "Manager", "Supervisor", "Engineer", "Technician"] },
        { page: "locations", icon: "fa-map-marker-alt", text: "Locations", roles: ["Admin", "Manager", "Supervisor"] },
        { page: "inventoryReport", icon: "fa-chart-line", text: "Inventory Report", roles: ["Admin", "Manager"] },
        { page: "userManagement", icon: "fa-users-cog", text: "User Management", roles: ["Admin"] },
        { page: "activityLog", icon: "fa-history", text: "Activity Log", roles: ["Admin"] },
    ];
    const navMenu = document.getElementById("navMenu");
    navMenu.innerHTML = navLinks
        .filter((link) => link.roles.includes(state.currentUser.role))
        .map(link => `<a href="#" class="nav-link flex items-center p-2 rounded-lg hover:bg-gray-700 ${state.currentPage === link.page ? "bg-gray-900" : ""}" data-page="${link.page}"><i class="fas ${link.icon} w-6 text-center"></i><span class="ml-3">${link.text}</span></a>`)
        .join("");
}

// --- MODAL SHOW/POPULATE FUNCTIONS ---

export function showAssetModal(assetId = null) {
    const form = document.getElementById("assetForm");
    form.reset();
    document.getElementById("assetId").value = "";
    populateLocationDropdown(document.getElementById("assetLocation"), "operational");
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

// --- NEW MODAL FUNCTIONS ---

export function showAssetDetailModal(asset) {
    if (!asset) return;
    const contentEl = document.getElementById('assetDetailContent');
    const locationName = getFullLocationName(asset.locationId);

    // --- NEW: Find related records ---

    // 1. Find related spare parts
    // This assumes a 'relatedAssets' array exists on your part objects.
    const relatedParts = state.cache.parts.filter(part => 
        part.relatedAssets && part.relatedAssets.includes(asset.id.toString())
    );

    // 2. Find transfer history from the activity log
    const transferHistory = state.cache.logs.filter(log => 
        log.action === "Asset Transferred" && log.details.includes(asset.name)
    );

    // --- Updated HTML with new sections ---
    contentEl.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">${asset.name}</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Tag/Serial:</strong> ${asset.tag}</div>
            <div><strong>Status:</strong> ${asset.status}</div>
            <div><strong>Category:</strong> ${asset.category}</div>
            <div><strong>Location:</strong> ${locationName}</div>
            <div><strong>Purchase Date:</strong> ${asset.purchaseDate}</div>
            <div><strong>Cost:</strong> ${asset.currency} ${asset.cost}</div>
        </div>

        <h3 class="text-lg font-bold mt-6 mb-2">Related Spare Parts</h3>
        <div class="bg-gray-50 p-3 rounded-md text-sm">
            ${relatedParts.length > 0 ? `
                <ul class="list-disc list-inside">
                    ${relatedParts.map(p => `<li>${p.name} (SKU: ${p.sku})</li>`).join('')}
                </ul>
            ` : `<p class="text-gray-500">No spare parts are linked to this asset.</p>`}
        </div>

        <h3 class="text-lg font-bold mt-6 mb-2">Transfer History</h3>
        <div class="bg-gray-50 p-3 rounded-md text-sm">
             ${transferHistory.length > 0 ? `
                <ul class="space-y-2">
                    ${transferHistory.map(log => `
                        <li class="border-b border-gray-200 pb-1">
                            <p>${log.details}</p>
                            <p class="text-xs text-gray-500">By ${log.user} on ${new Date(log.timestamp).toLocaleString()}</p>
                        </li>
                    `).join('')}
                </ul>
            ` : `<p class="text-gray-500">No transfer history found for this asset.</p>`}
        </div>
        
        <h3 class="text-lg font-bold mt-6 mb-2">Work Order History</h3>
        `;
    document.getElementById('assetDetailModal').style.display = 'flex';
}

export function showTransferAssetModal(asset) {
    if (!asset) return;
    document.getElementById('transferAssetId').value = asset.id;
    document.getElementById('transferAssetName').textContent = asset.name;
    document.getElementById('transferAssetModal').style.display = 'flex';
}

export function showPartModal(partId = null) {
    const form = document.getElementById("partForm");
    form.reset();
    document.getElementById("partId").value = "";
    
    // Populate the Related Assets dropdown
    const assetSelect = document.getElementById("partRelatedAssets");
    assetSelect.innerHTML = ''; // Clear existing options
    state.cache.assets.filter(can.view).forEach(asset => {
        const option = document.createElement('option');
        option.value = asset.id;
        // --- THIS LINE HAS BEEN UPDATED ---
        option.textContent = `${asset.name} (Tag: ${asset.tag})`;
        assetSelect.appendChild(option);
    });

    // Populate the Storage Location dropdown
    populateLocationDropdown(document.getElementById("partLocation"), "storage");

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
            
            // Pre-select related assets if they exist
            if (part.relatedAssets) {
                Array.from(assetSelect.options).forEach(option => {
                    if (part.relatedAssets.includes(option.value)) {
                        option.selected = true;
                    }
                });
            }
        }
    } else {
        document.getElementById("partModalTitle").textContent = "Add Spare Part";
    }
    document.getElementById("partModal").style.display = "flex";
}

export function showWorkOrderModal(woId = null) {
    const form = document.getElementById("workOrderForm");
    form.reset();
    document.getElementById("workOrderId").value = "";
    document.getElementById("woChecklistContainer").innerHTML = "";
    document.getElementById("woPartsContainer").innerHTML = "";
    document.getElementById("woPartsSection").style.display = "none";
    const assets = state.cache.assets.filter(can.view);
    document.getElementById("woAsset").innerHTML = '<option value="">Select Asset</option>' + assets.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
    const users = state.cache.users.filter((u) => ["Engineer", "Technician", "Supervisor"].includes(u.role) && can.view(u));
    document.getElementById("woAssignedTo").innerHTML = '<option value="">Assign To</option>' + users.map((u) => `<option value="${u.id}">${u.fullName}</option>`).join("");
    document.getElementById("addWoPartBtn").onclick = () => addWoPartRow();
    document.getElementById("woTask").onchange = (e) => {
        const task = e.target.value;
        const partsSection = document.getElementById("woPartsSection");
        partsSection.style.display = task === "Replacement" || task === "Assemble" ? "block" : "none";
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

export function showCalendarDetailModal(date, workOrders) {
    document.getElementById("calendarDetailModalTitle").textContent = `Work Orders for ${date}`;
    const contentEl = document.getElementById("calendarDetailContent");
    if (workOrders.length === 0) {
        contentEl.innerHTML = "<p>No work orders scheduled for this day.</p>";
    } else {
        contentEl.innerHTML = workOrders.map((wo) => {
            const asset = state.cache.assets.find((a) => a.id === parseInt(wo.assetId));
            return `<div class="p-3 border rounded-lg hover:bg-gray-50"><p class="font-bold">${wo.title}</p><p class="text-sm"><strong>Asset:</strong> ${asset ? asset.name : "N/A"}</p><p class="text-sm"><strong>Status:</strong> ${wo.status}</p><p class="text-sm"><strong>Priority:</strong> ${wo.priority}</p></div>`;
        }).join("");
    }
    document.getElementById("calendarDetailModal").style.display = "flex";
}

export function showEditUserModal(userId) {
    const user = state.cache.users.find(u => u.id === userId);
    if (!user) return;
    document.getElementById("editUserId").value = user.id;
    document.getElementById("editUserFullName").textContent = user.fullName;
    document.getElementById("editUserRole").value = user.role;
    document.getElementById("editUserModal").style.display = "flex";
}

export function addChecklistItem(text) {
    const container = document.getElementById("woChecklistContainer");
    const itemDiv = document.createElement("div");
    itemDiv.className = "flex items-center gap-2 checklist-item";
    // The button no longer has an onclick attribute. It just has the class.
    itemDiv.innerHTML = `<span class="flex-grow p-2 bg-gray-100 rounded">${text}</span><button type="button" class="remove-checklist-item-btn text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>`;
    container.appendChild(itemDiv);
}

export function addWoPartRow(selectedPartId = "", quantity = 1) {
    const container = document.getElementById("woPartsContainer");
    const allParts = state.cache.parts;
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 wo-part-row mt-2";
    const select = document.createElement("select");
    select.className = "w-2/3 px-3 py-2 border rounded wo-part-select";
    select.innerHTML = '<option value="">Select a part...</option>' + allParts.map((p) => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join("");
    select.value = selectedPartId;
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.className = "w-1/3 px-3 py-2 border rounded wo-part-qty";
    qtyInput.value = quantity;
    qtyInput.min = 1;
    qtyInput.placeholder = "Qty";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-wo-part-btn text-red-500 hover:text-red-700";
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    removeBtn.onclick = () => row.remove();
    row.appendChild(select);
    row.appendChild(qtyInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
}

export function populateLocationDropdown(selectElement, type = "all") {
    const { productionLines = [], cabinets = [], shelves = [], boxes = [] } = state.cache.locations || {};
    let options = '<option value="">Select a location</option>';
    if (type === "all" || type === "operational") {
        const filteredOpLocations = (state.currentUser.role === "Admin" ? productionLines : productionLines.filter((loc) => {
            const { subLines = [] } = state.cache.locations || {};
            const subLine = subLines.find((sl) => sl.id === loc.subLineId);
            return (subLine && subLine.departmentId === state.currentUser.departmentId);
        })).map((loc) => `<option value="pl-${loc.id}">${getFullLocationName(`pl-${loc.id}`)}</option>`).join("");
        if (filteredOpLocations) {
            options += `<optgroup label="Production Lines">${filteredOpLocations}</optgroup>`;
        }
    }
    if (type === "all" || type === "storage") {
        const filteredStorageLocations = (state.currentUser.role === "Admin" ? boxes : boxes.filter((box) => {
            const shelf = state.cache.locations.shelves.find((s) => s.id === box.shelfId);
            const cabinet = shelf ? state.cache.locations.cabinets.find((c) => c.id === shelf.cabinetId) : null;
            return cabinet && cabinet.departmentId === state.currentUser.departmentId;
        })).map((loc) => `<option value="box-${loc.id}">${getFullLocationName(`box-${loc.id}`)}</option>`).join("");
        if (filteredStorageLocations) {
            options += `<optgroup label="Storage Boxes">${filteredStorageLocations}</optgroup>`;
        }
    }
    selectElement.innerHTML = options;
}

export function showCompleteWorkOrderModal(workOrder) {
    if (!workOrder) return;
    
    // Set the hidden ID and the title in the modal
    document.getElementById('completeWorkOrderId').value = workOrder.id;
    document.getElementById('completeWoTitle').textContent = workOrder.title;

    // Populate the checklist for confirmation
    const checklistContainer = document.getElementById('completeWoChecklist');
    checklistContainer.innerHTML = ''; // Clear previous items
    if (workOrder.checklist && workOrder.checklist.length > 0) {
        workOrder.checklist.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'flex items-center';
            itemEl.innerHTML = `
                <i class="fas fa-check-square text-green-500 mr-2"></i>
                <span>${item.text}</span>
            `;
            checklistContainer.appendChild(itemEl);
        });
    } else {
        checklistContainer.innerHTML = '<p class="text-gray-500">No checklist items for this work order.</p>';
    }

    // Clear previous notes and show the modal
    document.getElementById('completionNotes').value = '';
    document.getElementById('completeWorkOrderModal').style.display = 'flex';
}

// --- ADD ALL OF THE FOLLOWING FUNCTIONS TO THE END OF YOUR UI.JS FILE ---

export function showPartDetailModal(part) {
    if (!part) return;
    const contentEl = document.getElementById('partDetailContent');
    const locationName = getFullLocationName(part.locationId);
    
    // --- THIS IS THE FIX ---
    // Get the array of asset IDs and convert them all from strings to numbers.
    const relatedAssetIds = (part.relatedAssets || []).map(id => Number(id));

    // Now, find the full asset objects by comparing numbers to numbers.
    const relatedAssets = state.cache.assets.filter(asset => 
        relatedAssetIds.includes(asset.id)
    );

    contentEl.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">${part.name}</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Part Number/SKU:</strong> ${part.sku}</div>
            <div><strong>Category:</strong> ${part.category}</div>
            <div><strong>Quantity on Hand:</strong> ${part.quantity}</div>
            <div><strong>Low Stock Threshold:</strong> ${part.minQuantity}</div>
            <div><strong>Storage Location:</strong> ${locationName}</div>
            <div><strong>Maker:</strong> ${part.maker || 'N/A'}</div>
            <div><strong>Supplier:</strong> ${part.supplier || 'N/A'}</div>
            <div><strong>Price:</strong> ${part.currency} ${part.price}</div>
        </div>
        <h3 class="text-lg font-bold mt-6 mb-2">Related Assets</h3>
        <div class="bg-gray-50 p-3 rounded-md text-sm">
            ${relatedAssets.length > 0 ? `
                <ul class="list-disc list-inside">
                    ${relatedAssets.map(a => `<li>${a.name} (Tag: ${a.tag})</li>`).join('')}
                </ul>
            ` : `<p class="text-gray-500">No assets are linked to this part.</p>`}
        </div>
        ${part.attachmentRef ? `<h3 class="text-lg font-bold mt-6 mb-2">Attachments</h3><a href="${part.attachmentRef}" target="_blank" class="text-blue-500 hover:underline">View Attachment</a>` : ''}
    `;
    document.getElementById('partDetailModal').style.display = 'flex';
}

export function showWorkOrderDetailModal(workOrder) {
    if (!workOrder) return;
    const contentEl = document.getElementById('workOrderDetailContent');
    const asset = state.cache.assets.find(a => a.id === workOrder.assetId);
    const assignedUser = state.cache.users.find(u => u.id === workOrder.assignedTo);

    contentEl.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">${workOrder.title}</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Status:</strong> <span class="font-bold">${workOrder.status}</span></div>
            <div><strong>Priority:</strong> <span class="font-bold">${workOrder.priority}</span></div>
            <div><strong>Asset:</strong> ${asset?.name || 'N/A'}</div>
            <div><strong>Assigned To:</strong> ${assignedUser?.fullName || 'N/A'}</div>
            <div><strong>Due Date:</strong> ${workOrder.dueDate}</div>
            <div><strong>Task Type:</strong> ${workOrder.task}</div>
        </div>
        <h3 class="text-lg font-bold mt-6 mb-2">Description</h3>
        <p class="text-sm bg-gray-50 p-3 rounded">${workOrder.description}</p>
        
        <h3 class="text-lg font-bold mt-6 mb-2">Checklist</h3>
        <div class="space-y-1 text-sm">
            ${workOrder.checklist && workOrder.checklist.length > 0 ? workOrder.checklist.map(item => `
                <div class="flex items-center"><i class="far fa-square mr-2"></i> ${item.text}</div>
            `).join('') : '<p class="text-gray-500">No checklist.</p>'}
        </div>
    `;
    document.getElementById('workOrderDetailModal').style.display = 'flex';
}

export function showPartRequestModal() {
    // Populate dropdown with existing parts
    const partSelect = document.getElementById('requestPartId');
    partSelect.innerHTML = state.cache.parts
        .filter(can.view)
        .map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('');

    // Toggle visibility of new part fields
    const checkbox = document.getElementById('requestNewPartCheckbox');
    const newPartContainer = document.getElementById('newPartContainer');
    const existingPartContainer = document.getElementById('existingPartContainer');
    checkbox.addEventListener('change', () => {
        newPartContainer.classList.toggle('hidden', !checkbox.checked);
        existingPartContainer.classList.toggle('hidden', checkbox.checked);
    });
    // Reset state
    checkbox.checked = false;
    newPartContainer.classList.add('hidden');
    existingPartContainer.classList.remove('hidden');

    document.getElementById('partRequestModal').style.display = 'flex';
}

export function showStorageRequestModal() {
     const partSelect = document.getElementById('storageRequestPartId');
     partSelect.innerHTML = '<option value="">Select a part...</option>' + state.cache.parts
        .filter(p => can.view(p) && p.quantity > 0)
        .map(p => `<option value="${p.id}">${p.name} (In Stock: ${p.quantity})</option>`).join('');
    document.getElementById('storageRequestModal').style.display = 'flex';
}

export function showReceivePartsModal() {
    const requestSelect = document.getElementById('receiveRequestId');
    const approvedRequests = state.cache.partRequests.filter(pr => pr.status === 'Approved' && can.view(pr));
    requestSelect.innerHTML = '<option value="">Select an approved request...</option>' + approvedRequests.map(pr => {
        const partName = pr.newPartName || state.cache.parts.find(p => p.id === pr.partId)?.name;
        return `<option value="${pr.id}">Request #${pr.id} - ${pr.quantity} x ${partName}</option>`
    }).join('');
    document.getElementById('receivePartsModal').style.display = 'flex';
}

// js/ui.js

// js/ui.js

// js/ui.js

// js/ui.js

export async function showRestockPartsModal() {
    try {
        showTemporaryMessage("Loading received parts...");
        state.cache.receivedParts = await api.getReceivedParts();
    } catch (error) {
        showTemporaryMessage("Failed to load received parts.", true);
        return;
    }

    const requestSelect = document.getElementById('restockPartId');
    const receivedParts = state.cache.receivedParts;
    requestSelect.innerHTML = '<option value="">Select received parts...</option>' + receivedParts.map(rp => {
        const partName = rp.newPartName || state.cache.parts.find(p => p.id === rp.partId)?.name;
        return `<option value="${rp.id}">Received #${rp.id} - ${rp.quantity} x ${partName}</option>`
    }).join('');

    const directPartSelect = document.getElementById('directStockPartId');
    directPartSelect.innerHTML = '<option value="">Select an existing part...</option>' + state.cache.parts
        .filter(can.view)
        .map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('');

    populateLocationDropdown(document.getElementById('restockLocationId'), 'storage');
    document.getElementById('restockPartsForm').reset();
    
    const fromRequestContainer = document.getElementById('fromRequestContainer');
    const directStockContainer = document.getElementById('directStockContainer');
    const requestBtn = document.getElementById('restockTypeRequest');
    const directBtn = document.getElementById('restockTypeDirect');
    
    const isNewPartCheckbox = document.getElementById('isNewPartCheckbox');
    const existingPartSelector = document.getElementById('existingPartSelector');
    const newPartInputs = document.getElementById('newPartInputs');
    
    // --- Get all the relevant input elements once ---
    const restockPartIdInput = document.getElementById('restockPartId');
    const directStockPartIdInput = document.getElementById('directStockPartId');
    const directStockQuantityInput = document.getElementById('directStockQuantity');
    const newPartNameInput = document.getElementById('newPartName');
    const newPartSkuInput = document.getElementById('newPartSku');

    isNewPartCheckbox.addEventListener('change', () => {
        const isChecked = isNewPartCheckbox.checked;
        existingPartSelector.style.display = isChecked ? 'none' : 'block';
        newPartInputs.style.display = isChecked ? 'block' : 'none';
        
        directStockPartIdInput.required = !isChecked;
        directStockPartIdInput.disabled = isChecked;
        newPartNameInput.required = isChecked;
        newPartSkuInput.required = isChecked;
    });

    const setMode = (mode) => {
        const isRequestMode = mode === 'request';
        fromRequestContainer.style.display = isRequestMode ? 'block' : 'none';
        directStockContainer.style.display = isRequestMode ? 'none' : 'block';

        // --- UPDATE THIS LOGIC TO INCLUDE .disabled ---
        // Toggle fields for "From Request" mode
        restockPartIdInput.required = isRequestMode;
        restockPartIdInput.disabled = !isRequestMode;

        // Toggle fields for "Direct Stock" mode
        directStockPartIdInput.required = !isRequestMode;
        directStockPartIdInput.disabled = isRequestMode;
        directStockQuantityInput.required = !isRequestMode;
        directStockQuantityInput.disabled = isRequestMode;
        
        isNewPartCheckbox.checked = false;
        existingPartSelector.style.display = 'block';
        newPartInputs.style.display = 'none';
        newPartNameInput.required = false;
        newPartSkuInput.required = false;

        requestBtn.classList.toggle('bg-blue-500', isRequestMode);
        requestBtn.classList.toggle('text-white', isRequestMode);
        requestBtn.classList.toggle('bg-white', !isRequestMode);
        requestBtn.classList.toggle('text-gray-700', !isRequestMode);
        directBtn.classList.toggle('bg-blue-500', !isRequestMode);
        directBtn.classList.toggle('text-white', !isRequestMode);
        directBtn.classList.toggle('bg-white', isRequestMode);
        directBtn.classList.toggle('text-gray-700', isRequestMode);
    };

    requestBtn.onclick = () => setMode('request');
    directBtn.onclick = () => setMode('direct');

    setMode('request');
    document.getElementById('restockPartsModal').style.display = 'flex';
}
// This function was also missing from your original ui.js
export function populateLocationDropdowns(divisionSelect, departmentSelect) {
    const { divisions = [], departments = [] } = state.cache.locations;

    if (divisionSelect) {
        divisionSelect.innerHTML = '<option value="">Select Division</option>' + 
            divisions.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        
        divisionSelect.onchange = () => {
            const selectedDivisionId = parseInt(divisionSelect.value);
            const filteredDepartments = departments.filter(d => d.divisionId === selectedDivisionId);
            if (departmentSelect) {
                departmentSelect.innerHTML = '<option value="">Select Department</option>' + 
                    filteredDepartments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            }
        };
    }
}

export function renderInventoryReportPage() {
    const today = new Date().toISOString().split('T')[0];
    return `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Inventory Report</h1>
        </div>
        <div class="bg-white p-4 rounded-lg shadow mb-6">
            <form id="reportForm" class="flex items-end gap-4">

                <div>
                    <label for="dateRangeSelect" class="block text-sm font-medium text-gray-700">Date Range</label>
                    <select id="dateRangeSelect" class="mt-1 px-3 py-2 border rounded w-full">
                        <option value="custom">Custom Range</option>
                        <option value="this-week">This Week</option>
                        <option value="last-7-days">Last 7 Days</option>
                        <option value="this-month">This Month</option>
                        <option value="last-30-days">Last 30 Days</option>
                        <option value="last-month">Last Month</option>
                    </select>
                </div>

                <div>
                    <label for="startDate" class="block text-sm font-medium text-gray-700">Start Date</label>
                    <input type="date" id="startDate" value="${today}" class="mt-1 px-3 py-2 border rounded w-full">
                </div>
                <div>
                    <label for="endDate" class="block text-sm font-medium text-gray-700">End Date</label>
                    <input type="date" id="endDate" value="${today}" class="mt-1 px-3 py-2 border rounded w-full">
                </div>
                <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Generate Report</button>
            </form>
        </div>
        <div id="reportResultContainer" class="bg-white p-4 rounded-lg shadow">
            <p class="text-gray-500">Please select a date range and click "Generate Report".</p>
        </div>
    `;
}

// js/ui.js

export function showPartRequestDetailModal(req) {
    const contentEl = document.getElementById('partRequestDetailContent');
    if (!req) {
        contentEl.innerHTML = '<p>Request not found.</p>';
        return;
    }
    const requester = state.cache.users.find(u => u.id === req.requesterId)?.fullName || 'N/A';
    const approver = req.approverId ? state.cache.users.find(u => u.id === req.approverId)?.fullName : 'N/A';
    const part = req.partId ? state.cache.parts.find(p => p.id === req.partId) : null;
    const partName = part ? part.name : (req.newPartName || 'New Part');

    contentEl.innerHTML = `
        <p><strong>Part:</strong> ${partName}</p>
        <p><strong>Quantity:</strong> ${req.quantity}</p>
        <p><strong>Status:</strong> ${req.status}</p>
        <p><strong>Requester:</strong> ${requester}</p>
        <p><strong>Request Date:</strong> ${new Date(req.requestDate).toLocaleString()}</p>
        <p><strong>Approver:</strong> ${approver}</p>
        <p><strong>Approval Date:</strong> ${req.approvalDate ? new Date(req.approvalDate).toLocaleString() : 'N/A'}</p>
        <p><strong>Purpose:</strong> ${req.purpose}</p>
        ${req.status === 'Rejected' ? `<p class="text-red-600"><strong>Rejection Reason:</strong> ${req.rejectionReason}</p>` : ''}
    `;
    document.getElementById('partRequestDetailModal').style.display = 'flex';
}

export function showEditPartRequestModal(req) {
    if (!req) return;
    
    // Reset and configure the main request modal for editing
    const modal = document.getElementById('partRequestModal');
    modal.querySelector('h2').textContent = 'Edit Part Request';
    
    const form = document.getElementById('partRequestForm');
    form.reset();

    // Hide the "new part" functionality for editing
    document.getElementById('requestNewPartCheckbox').closest('div').style.display = 'none';
    document.getElementById('newPartContainer').classList.add('hidden');
    document.getElementById('existingPartContainer').classList.remove('hidden');

    // Populate form with existing data
    document.getElementById('partRequestId').value = req.id;
    document.getElementById('requestPartId').value = req.partId;
    document.getElementById('requestQuantity').value = req.quantity;
    document.getElementById('requestPurpose').value = req.purpose;

    modal.style.display = 'flex';
}

export function renderPmSchedulesPage() {
    const schedules = state.cache.pmSchedules || [];
    const header = renderPageHeader("Preventive Maintenance Schedules", [
        '<button id="generatePmWoBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-cogs mr-2"></i>Generate PM Work Orders</button>',
        '<button id="addPmScheduleBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Add PM Schedule</button>'
    ]);
    
    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
        <table class="w-full">
          <thead><tr class="border-b">
            <th class="p-2 text-left">Schedule Title</th>
            <th class="p-2 text-left">Asset</th>
            <th class="p-2 text-left">Frequency</th>
            <th class="p-2 text-left">Start Date</th>
            <th class="p-2 text-left">Next PM Date</th>
            <th class="p-2 text-left">WO Due Date</th>
            <th class="p-2 text-left">Status</th>
            <th class="p-2 text-left">Actions</th>
          </tr></thead>
          <tbody>
            ${schedules.map(s => {
                const assetName = state.cache.assets.find(a => a.id === s.assetId)?.name || 'N/A';
                
                // Determine the due date buffer text based on frequency
                let dueDateText = "(+7 Days)";
                if (s.frequency === 'Quarterly') dueDateText = "(+14 Days)";
                if (s.frequency === 'Yearly') dueDateText = "(+30 Days)";

                return `<tr class="border-b hover:bg-gray-50">
                    <td class="p-2">${s.title}</td>
                    <td class="p-2">${assetName}</td>
                    <td class="p-2">${s.frequency}</td>
                    <td class="p-2">${s.schedule_start_date}</td>
                    <td class="p-2 font-semibold">${calculateNextPmDate(s)}</td>
                    <td class="p-2 text-sm text-gray-600">${dueDateText}</td>
                    <td class="p-2">${s.is_active ? '<span class="text-green-600">Active</span>' : '<span class="text-gray-500">Inactive</span>'}</td>
                    <td class="p-2 space-x-2">
                        <button class="view-pm-btn text-blue-500 hover:text-blue-700" data-id="${s.id}" title="View Details"><i class="fas fa-eye"></i></button>
                        <button class="edit-pm-btn text-yellow-500 hover:text-yellow-700" data-id="${s.id}" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="delete-pm-btn text-red-500 hover:text-red-700" data-id="${s.id}" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
}

export function showPmScheduleModal(schedule = null) {
    const form = document.getElementById("pmScheduleForm");
    form.reset();
    
    // --- THIS IS THE FIX ---
    // This line was missing. It defines the modalTitle variable.
    const modalTitle = document.querySelector("#pmScheduleModal h2");
    const isActiveCheckbox = document.getElementById('pmIsActive');

    // Set default values for creating a new schedule
    document.getElementById("pmScheduleId").value = "";
    modalTitle.textContent = "New PM Schedule";
    document.getElementById("pmStartDate").value = new Date().toISOString().split('T')[0];
    isActiveCheckbox.checked = true; // Default to active for new schedules
    
    // Populate dropdowns for both modes
    const assets = state.cache.assets.filter(can.view);
    document.getElementById("pmAsset").innerHTML = '<option value="">Select Asset</option>' + assets.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
    const users = state.cache.users.filter((u) => ["Engineer", "Technician", "Supervisor"].includes(u.role) && can.view(u));
    document.getElementById("pmAssignedTo").innerHTML = '<option value="">Assign To</option>' + users.map((u) => `<option value="${u.id}">${u.fullName}</option>`).join("");

    // If we are editing, pre-fill the form with the schedule's data
    if (schedule) {
        modalTitle.textContent = "Edit PM Schedule";
        document.getElementById("pmScheduleId").value = schedule.id;
        document.getElementById("pmTitle").value = schedule.title;
        document.getElementById("pmStartDate").value = schedule.schedule_start_date;
        document.getElementById("pmFrequency").value = schedule.frequency;
        document.getElementById("pmAsset").value = schedule.assetId;
        document.getElementById("pmAssignedTo").value = schedule.assignedTo;
        document.getElementById("pmTask").value = schedule.task;
        document.getElementById("pmDescription").value = schedule.description;
        isActiveCheckbox.checked = !!schedule.is_active;
    }

    document.getElementById('pmScheduleModal').style.display = 'flex';
}

export function showPmScheduleDetailModal(schedule) {
    const contentEl = document.getElementById('pmScheduleDetailContent');
    if (!schedule) {
        contentEl.innerHTML = '<p>Schedule not found.</p>';
        return;
    }
    const asset = state.cache.assets.find(a => a.id === schedule.assetId);
    const assignedUser = state.cache.users.find(u => u.id === schedule.assignedTo);
    const nextDueDate = calculateNextPmDueDate(schedule);

    contentEl.innerHTML = `
        <p><strong>Title:</strong> ${schedule.title}</p>
        <p><strong>Asset:</strong> ${asset?.name || 'N/A'}</p>
        <p><strong>Status:</strong> ${schedule.is_active ? 'Active' : 'Inactive'}</p>
        <hr class="my-2">
        <p><strong>Frequency:</strong> ${schedule.frequency}</p>
        <p><strong>Schedule Start Date:</strong> ${schedule.schedule_start_date}</p>
        <p><strong>Last Generated:</strong> ${schedule.last_generated_date || 'Never'}</p>
        <p class="font-bold"><strong>Next Due Date:</strong> ${nextDueDate}</p>
        <hr class="my-2">
        <p><strong>Assigned To:</strong> ${assignedUser?.fullName || 'N/A'}</p>
        <p><strong>Task Type:</strong> ${schedule.task}</p>
        <p><strong>Description:</strong> ${schedule.description || 'None'}</p>
    `;
    document.getElementById('pmScheduleDetailModal').style.display = 'flex';
}

// THIS IS A NEW HELPER FUNCTION
function renderPageHeader(title, buttons = []) {
  return `
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">${title}</h1>
        <div class="space-x-2">
            ${buttons.join('\n')}
        </div>
    </div>
  `;
}