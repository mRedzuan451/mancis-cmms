// js/ui.js

import { state } from './config.js';
import { can } from './auth.js';
import { api } from './api.js';
import { getFullLocationName, getUserDepartment, showTemporaryMessage, calculateNextPmDate } from './utils.js';

function renderPageHeader(title, buttons = []) {
    const renderedButtons = buttons.filter(Boolean).join('\n');
  
  return `
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">${title}</h1>
        <div class="space-x-2">
            ${buttons.join('\n')}
        </div>
    </div>
  `;
}

export function renderDashboard() {
  const assets = state.cache.assets.filter(can.view);
  const workOrders = state.cache.workOrders.filter(can.view);
  const parts = state.cache.parts.filter(can.view);
  const partRequests = state.cache.partRequests.filter(can.view);
  
  const openWOs = workOrders.filter((wo) => wo.status !== "Completed").length;
  const pendingRequests = partRequests.filter((pr) => pr.status === "Requested" || pr.status === "Requested from Storage").length;
  const lowStockItems = parts.filter((p) => parseInt(p.quantity) <= parseInt(p.minQuantity)).length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to the beginning of the current day.

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7); // Set the end of our 7-day window.

  const upcomingPMs = workOrders.filter(wo => {
      if (wo.wo_type !== 'PM' || wo.status === 'Completed') return false;
      
      // Create a date object from the WO's start_date string in a way that avoids UTC conversion.
      const woStartDate = new Date(wo.start_date + 'T00:00:00');
      
      // Check if the PM's start date falls within our 7-day window.
      return woStartDate >= today && woStartDate < sevenDaysFromNow;
  }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  
  const overdueWOs = workOrders.filter(wo => {
      if (wo.status === 'Completed') return false;
      // Use the same robust date creation for due dates.
      const woDueDate = new Date(wo.dueDate + 'T00:00:00');
      return woDueDate < today;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return `
    <h1 class="text-3xl font-bold mb-6">Dashboard</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        <div class="bg-white p-6 rounded-lg shadow cursor-pointer hover:bg-gray-50 dashboard-kpi-box" data-page="assets">
            <h3 class="text-gray-500">Total Assets</h3>
            <p class="text-3xl font-bold">${assets.length}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow cursor-pointer hover:bg-gray-50 dashboard-kpi-box" data-page="workOrders">
            <h3 class="text-gray-500">Open Work Orders</h3>
            <p class="text-3xl font-bold">${openWOs}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow cursor-pointer hover:bg-gray-50 dashboard-kpi-box" data-page="partRequests">
            <h3 class="text-gray-500">Pending Part Requests</h3>
            <p class="text-3xl font-bold">${pendingRequests}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow cursor-pointer hover:bg-gray-50 dashboard-kpi-box" data-page="parts">
            <h3 class="text-gray-500">Low Stock Items</h3>
            <p class="text-3xl font-bold">${lowStockItems}</p>
        </div>
        </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
             <div>
                <h2 class="text-2xl font-bold mb-4">Upcoming PMs (Next 7 Days)</h2>
                <div class="bg-white p-4 rounded-lg shadow min-h-[200px]">
                    ${upcomingPMs.length > 0 ? `
                        <table class="w-full">
                            <thead><tr class="border-b"><th class="text-left p-2">Title</th><th class="text-left p-2">Asset</th><th class="text-left p-2">Start Date</th></tr></thead>
                            <tbody>${upcomingPMs.map(wo => `<tr class="border-b hover:bg-gray-50"><td class="p-2">${wo.title}</td><td class="p-2">${state.cache.assets.find(a => a.id === parseInt(wo.assetId))?.name || "N/A"}</td><td class="p-2">${wo.start_date}</td></tr>`).join("")}</tbody>
                        </table>` : `<p class="text-gray-500">No upcoming PMs in the next 7 days.</p>`}
                </div>
            </div>
            <div class="lg:col-span-2">
                <h2 class="text-2xl font-bold mb-4">Overdue Work Orders</h2>
                <div class="bg-white p-4 rounded-lg shadow min-h-[200px]">
                    ${overdueWOs.length > 0 ? `
                        <table class="w-full">
                            <thead><tr class="border-b"><th class="text-left p-2">Title</th><th class="text-left p-2">Asset</th><th class="text-left p-2">Days Overdue</th></tr></thead>
                            <tbody>${overdueWOs.map(wo => {
                                const diffTime = Math.abs(today - new Date(wo.dueDate + 'T00:00:00'));
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                return `<tr class="border-b hover:bg-gray-50"><td class="p-2">${wo.title}</td><td class="p-2">${state.cache.assets.find(a => a.id === parseInt(wo.assetId))?.name || "N/A"}</td><td class="p-2 text-red-600 font-bold">${diffDays} day(s)</td></tr>`}).join("")}</tbody>
                        </table>` : `<p class="text-gray-500">No overdue work orders. Great job!</p>`}
                </div>
            </div>
        </div>
        
        <div>
            <h2 class="text-2xl font-bold mb-4">Work Order Status</h2>
            <div class="bg-white p-4 rounded-lg shadow" style="height: 350px;">
                <canvas id="woStatusChart"></canvas>
            </div>
        </div>
    </div>`;
}

export function renderAssetsPage() {
    const { permissions } = state.currentUser;
    const assets = state.cache.assets;
    const header = renderPageHeader("Asset Management", [
        permissions.asset_delete ? '<button id="deleteSelectedBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded hidden"><i class="fas fa-trash-alt mr-2"></i>Delete Selected</button>' : '',
        permissions.asset_edit ? '<button id="uploadAssetsBtn" class="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-upload mr-2"></i>Upload List</button>' : '',
        '<button id="printAssetListBtn" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-print mr-2"></i>Print List</button>',
        permissions.asset_create ? '<button id="addAssetBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Add Asset</button>' : ''
    ]);
    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
          <input type="file" id="assetUploadInput" class="hidden" accept=".csv">
          <input type="text" id="assetSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by name, tag, or category...">
          <div class="overflow-x-auto">
              <table class="w-full" id="assetTable">
                  <thead>
                      <tr class="border-b">
                          <th class="p-2 w-4"><input type="checkbox" id="selectAllCheckbox"></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="name">Name <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="tag">Tag <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="locationId">Location <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="status">Status <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left">Actions</th>
                      </tr>
                  </thead>
                  <tbody id="assetTableBody">${generateTableRows("assets", assets)}</tbody>
              </table>
          </div>
          <div id="assetPagination">
              ${renderPagination('assets')}
          </div>
          </div>`;
}

export function renderPartsPage() {
    const { permissions } = state.currentUser;
    const parts = state.cache.parts;
    const header = renderPageHeader("Spare Parts Management", [
        permissions.part_delete ? '<button id="deleteSelectedBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded hidden"><i class="fas fa-trash-alt mr-2"></i>Delete Selected</button>' : '',
        permissions.part_edit ? '<button id="uploadPartsBtn" class="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-upload mr-2"></i>Upload List</button>' : '',
        '<button id="printPartListBtn" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-print mr-2"></i>Print List</button>',
        permissions.part_create ? '<button id="addPartBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Add Parts</button>' : ''
    ]);
    const departmentHeader = state.currentUser.role === 'Admin' 
        ? '<th class="p-2 text-left cursor-pointer" data-sort="departmentName">Department <i class="fas fa-sort"></i></th>' 
        : '';
    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
          <input type="file" id="partUploadInput" class="hidden" accept=".csv">
          <input type="text" id="partSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search...">
          <div class="overflow-x-auto">
              <table class="w-full" id="partTable">
                  <thead>
                      <tr class="border-b">
                          <th class="p-2 w-4"><input type="checkbox" id="selectAllCheckbox"></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="name">Part Name <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="sku">SKU <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="quantity">Quantity <i class="fas fa-sort"></i></th>
                          ${departmentHeader}
                          <th class="p-2 text-left">Actions</th>
                      </tr>
                  </thead>
                  <tbody id="partTableBody">${generateTableRows("parts", parts)}</tbody>
              </table>
          </div>
          <div id="partPagination">
              ${renderPagination('parts')}
          </div>
          </div>`;
}

export function renderWorkOrdersPage() {
    const { permissions } = state.currentUser;
    const workOrders = state.cache.workOrders.filter(can.view);
    const header = renderPageHeader("Work Order Management", [
        permissions.wo_delete ? '<button id="deleteSelectedBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded hidden"><i class="fas fa-trash-alt mr-2"></i>Delete Selected</button>' : '',
        permissions.wo_create ? '<button id="addWorkOrderBtn" class="bg-blue-500 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Create Corrective WO</button>' : ''
    ]);
    return `
      ${header}
      <div class="mb-4 border-b border-gray-200">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            </nav>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
          <input type="text" id="workOrderSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search...">
          <div class="overflow-x-auto">
              <table class="w-full" id="workOrderTable">
                  <thead>
                      <tr class="border-b">
                          <th class="p-2 w-4"><input type="checkbox" id="selectAllCheckbox"></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="title">Title <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="assetId">Asset <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="start_date">Start Date <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="dueDate">Due Date <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="status">Status <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left">Actions</th>
                      </tr>
                  </thead>
                  <tbody id="workOrderTableBody">${generateTableRows("workOrders", workOrders)}</tbody>
              </table>
          </div>
          <div id="workOrderPagination">
              ${renderPagination('workOrders')}
          </div>
    </div>`;
}

export function renderUserManagementPage() {
    const { permissions } = state.currentUser;
    const users = state.cache.users;
    const header = renderPageHeader("User Management", [
        permissions.user_edit ? '<button id="addUserBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-user-plus mr-2"></i>Add User</button>' : '',
        permissions.user_delete ? '<button id="deleteSelectedBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded hidden"><i class="fas fa-trash-alt mr-2"></i>Delete Selected</button>' : '',
        '<button id="refreshDataBtn" class="bg-gray-500 text-white font-bold py-2 px-4 rounded"><i class="fas fa-sync-alt mr-2"></i>Refresh</button>'
    ]);
    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
          <input type="text" id="userSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by Name, Username, Role, or Department...">
          <div class="overflow-x-auto">
              <table class="w-full" id="userTable">
                  <thead><tr class="border-b">
                      <th class="p-2 w-4"><input type="checkbox" id="selectAllCheckbox"></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="fullName">Full Name <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="username">Username <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="role">Role <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="departmentId">Department <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left">Actions</th>
                  </tr></thead>
                  <tbody id="userTableBody">${generateTableRows("users", users)}</tbody>
              </table>
          </div>
      </div>`;
}

export function renderWorkOrderCalendar() {
    const { calendarDate } = state;
    const month = calendarDate.getMonth();
    const year = calendarDate.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const workOrders = state.cache.workOrders.filter(can.view);

    // 1. Calculate summary stats for the current month
    const monthlyWOs = workOrders.filter(wo => {
        const woDate = new Date(wo.start_date + 'T00:00:00');
        return woDate.getFullYear() === year && woDate.getMonth() === month;
    });

    const totalCount = monthlyWOs.length;
    const completedCount = monthlyWOs.filter(wo => wo.status === 'Completed').length;
    const pmCount = monthlyWOs.filter(wo => wo.wo_type === 'PM').length;
    const cmCount = monthlyWOs.filter(wo => wo.wo_type === 'CM').length;

    // 2. Create the HTML for the summary section
    const summaryHtml = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gray-50 p-4 rounded-lg shadow text-center">
                <h4 class="text-sm text-gray-500">Total WOs This Month</h4>
                <p class="text-2xl font-bold">${totalCount}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg shadow text-center">
                <h4 class="text-sm text-gray-500">Completed</h4>
                <p class="text-2xl font-bold text-green-600">${completedCount}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg shadow text-center">
                <h4 class="text-sm text-gray-500">Preventive (PM)</h4>
                <p class="text-2xl font-bold text-blue-600">${pmCount}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg shadow text-center">
                <h4 class="text-sm text-gray-500">Corrective (CM)</h4>
                <p class="text-2xl font-bold text-orange-600">${cmCount}</p>
            </div>
        </div>
    `;
    
    let calendarHtml = `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">Work Order Calendar</h1>
          <div class="flex items-center space-x-2">
              <button id="prevMonthBtn" class="px-3 py-1 bg-gray-200 rounded">&lt;</button>
              <h2 class="text-xl font-semibold">${calendarDate.toLocaleString("default",{ month: "long", year: "numeric" })}</h2>
              <button id="nextMonthBtn" class="px-3 py-1 bg-gray-200 rounded">&gt;</button>
          </div>
      </div>
      ${summaryHtml} 
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
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;

        const wosOnThisDay = workOrders.filter((wo) => wo.start_date === dateStr);
        
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
    
    calendarHtml += `
        <div class="mt-6 p-4 bg-white rounded-lg shadow">
            <h3 class="text-lg font-bold mb-3">Legend</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                    <h4 class="font-semibold mb-2">Priority (Background)</h4>
                    <div class="space-y-1">
                        <div class="flex items-center"><div class="w-4 h-4 rounded-full bg-red-100 mr-2"></div> High</div>
                        <div class="flex items-center"><div class="w-4 h-4 rounded-full bg-yellow-100 mr-2"></div> Medium</div>
                        <div class="flex items-center"><div class="w-4 h-4 rounded-full bg-blue-100 mr-2"></div> Low</div>
                    </div>
                </div>
                <div>
                    <h4 class="font-semibold mb-2">Status (Dot)</h4>
                    <div class="space-y-1">
                        <div class="flex items-center"><div class="w-3 h-3 rounded-full bg-green-500 mr-2"></div> Completed</div>
                        <div class="flex items-center"><div class="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div> Pending</div>
                        <div class="flex items-center"><div class="w-3 h-3 rounded-full bg-red-500 mr-2"></div> Delayed</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return calendarHtml;
}

export function renderLocationsPage() {
    const { divisions = [], departments = [], subLines = [], productionLines = [], cabinets = [], shelves = [], boxes = [] } = state.cache.locations || {};
    const isAdmin = state.currentUser.role === "Admin";
    const userDeptId = state.currentUser.departmentId;

    const header = renderPageHeader("Location Management", [
        '<button id="downloadLocationsBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-download mr-2"></i>Download List</button>'
    ]);

    const filteredCabinets = isAdmin ? cabinets : cabinets.filter(c => c.departmentId === userDeptId);
    const filteredCabinetIds = filteredCabinets.map(c => c.id);
    const filteredShelves = isAdmin ? shelves : shelves.filter(s => filteredCabinetIds.includes(s.cabinetId));
    const filteredShelfIds = filteredShelves.map(s => s.id);
    const filteredBoxes = isAdmin ? boxes : boxes.filter(b => filteredShelfIds.includes(b.shelfId));
    
    const cabinetParentDepts = isAdmin ? departments : departments.filter(d => d.id === userDeptId);

    return `
      ${header}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          ${isAdmin ? `
            <div class="bg-white p-4 rounded-lg shadow space-y-6">
                <div>
                  <h2 class="text-xl font-bold mb-4">Divisions</h2>
                  <ul class="space-y-2 mb-4 max-h-40 overflow-y-auto">${divisions.map(d => `<li class="flex justify-between items-center p-2 bg-gray-50 rounded"><span>${d.name}</span><button class="delete-location-btn text-red-500" data-id="${d.id}" data-type="division"><i class="fas fa-trash"></i></button></li>`).join("") || '<li class="text-gray-500">No divisions.</li>'}</ul>
                  <form id="addDivisionForm" class="flex gap-2 border-t pt-4"><input type="text" class="flex-grow px-2 py-1 border rounded" placeholder="New Division" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></form>
                </div>
                <div>
                  <h2 class="text-xl font-bold mb-4">Departments</h2>
                  <ul class="space-y-2 mb-4 max-h-40 overflow-y-auto">${departments.map(d => {
                      const division = divisions.find(div => div.id === d.divisionId);
                      return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div>
                                    <p>${d.name}</p>
                                    <p class="text-xs text-gray-500">In: ${division ? division.name : 'N/A'}</p>
                                </div>
                                <button class="delete-location-btn text-red-500" data-id="${d.id}" data-type="department"><i class="fas fa-trash"></i></button>
                              </li>`;
                  }).join("") || '<li class="text-gray-500">No departments.</li>'}</ul>
                  <form id="addDepartmentForm" class="border-t pt-4"><select class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Division</option>${divisions.map(d => `<option value="${d.id}">${d.name}</option>`).join("")}</select><div class="flex gap-2"><input type="text" class="flex-grow px-2 py-1 border rounded" placeholder="New Department" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div></form>
                </div>
                <div>
                  <h2 class="text-xl font-bold mb-4">Sub Lines</h2>
                  <ul class="space-y-2 mb-4 max-h-40 overflow-y-auto">${subLines.map(sl => {
                      const department = departments.find(dept => dept.id === sl.departmentId);
                      return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div>
                                    <p>${sl.name}</p>
                                    <p class="text-xs text-gray-500">In: ${department ? department.name : 'N/A'}</p>
                                </div>
                                <button class="delete-location-btn text-red-500" data-id="${sl.id}" data-type="subLine"><i class="fas fa-trash"></i></button>
                              </li>`;
                  }).join("") || '<li class="text-gray-500">No sub lines.</li>'}</ul>
                  <form id="addSubLineForm" class="border-t pt-4"><select class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Department</option>${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join("")}</select><div class="flex gap-2"><input type="text" class="flex-grow px-2 py-1 border rounded" placeholder="New Sub Line" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div></form>
                </div>
                <div>
                  <h2 class="text-xl font-bold mb-4">Production Lines</h2>
                  <ul class="space-y-2 mb-4 max-h-40 overflow-y-auto">${productionLines.map(pl => {
                      const subLine = subLines.find(sl => sl.id === pl.subLineId);
                      return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div>
                                    <p>${pl.name}</p>
                                    <p class="text-xs text-gray-500">In: ${subLine ? subLine.name : 'N/A'}</p>
                                </div>
                                <button class="delete-location-btn text-red-500" data-id="${pl.id}" data-type="productionLine"><i class="fas fa-trash"></i></button>
                              </li>`;
                  }).join("") || '<li class="text-gray-500">No lines.</li>'}</ul>
                  <form id="addProductionLineForm" class="border-t pt-4"><select class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Sub Line</option>${subLines.map(sl => `<option value="${sl.id}">${sl.name}</option>`).join("")}</select><div class="flex gap-2"><input type="text" class="flex-grow px-2 py-1 border rounded" placeholder="New Line" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div></form>
                </div>
            </div>
          ` : `
            <div class="bg-white p-4 rounded-lg shadow">
                <h2 class="text-xl font-bold mb-4">Production Locations</h2>
                <p class="text-sm text-gray-600">Contact an administrator to manage production locations.</p>
            </div>
          `}
          
          <div class="bg-white p-4 rounded-lg shadow space-y-4">
              <h2 class="text-xl font-bold mb-2">Storage Locations</h2>
              <p class="text-sm text-gray-500 mb-4">${isAdmin ? 'Manage all storage locations.' : 'Displaying storage for your department only.'}</p>
              
               <div>
                  <h3 class="font-semibold mb-2">Cabinets</h3>
                   <ul class="space-y-2 mb-4 max-h-40 overflow-y-auto">${filteredCabinets.map(c => {
                       const department = cabinetParentDepts.find(dept => dept.id === c.departmentId);
                       return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div>
                                    <p>${c.name}</p>
                                    <p class="text-xs text-gray-500">In: ${department ? department.name : 'N/A'}</p>
                                </div>
                                ${isAdmin ? `<button class="delete-location-btn text-red-500" data-id="${c.id}" data-type="cabinet"><i class="fas fa-trash"></i></button>` : ''}
                               </li>`;
                   }).join("") || '<li class="text-gray-500">No cabinets found.</li>'}</ul>
                  ${state.currentUser.permissions.location_management ? `<form id="addCabinetForm" class="border-t pt-2">${isAdmin ? `<select class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Department</option>${cabinetParentDepts.map(d => `<option value="${d.id}">${getFullLocationName(`dept-${d.id}`)}</option>`).join("")}</select>` : ''}<div class="flex gap-2"><input type="text" id="newCabinetName" class="flex-grow px-2 py-1 border rounded" placeholder="New Cabinet Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div></form>` : ''}
               </div>

               <div>
                  <h3 class="font-semibold mb-2">Shelves</h3>
                   <ul class="space-y-2 mb-4 max-h-40 overflow-y-auto">${filteredShelves.map(s => {
                       const cabinet = filteredCabinets.find(cab => cab.id === s.cabinetId);
                       return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div>
                                    <p>${s.name}</p>
                                    <p class="text-xs text-gray-500">In: ${cabinet ? cabinet.name : 'N/A'}</p>
                                </div>
                                ${isAdmin ? `<button class="delete-location-btn text-red-500" data-id="${s.id}" data-type="shelf"><i class="fas fa-trash"></i></button>` : ''}
                               </li>`;
                   }).join("") || '<li class="text-gray-500">No shelves found.</li>'}</ul>
                  ${state.currentUser.permissions.location_management ? `<form id="addShelfForm" class="border-t pt-2"><select class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Cabinet</option>${filteredCabinets.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select><div class="flex gap-2"><input type="text" class="flex-grow px-2 py-1 border rounded" placeholder="New Shelf Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div></form>` : ''}
               </div>

               <div>
                  <h3 class="font-semibold mb-2">Boxes</h3>
                   <ul class="space-y-2 mb-4 max-h-40 overflow-y-auto">${filteredBoxes.map(b => {
                       const shelf = filteredShelves.find(sh => sh.id === b.shelfId);
                       return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div>
                                    <p>${b.name}</p>
                                    <p class="text-xs text-gray-500">In: ${shelf ? shelf.name : 'N/A'}</p>
                                </div>
                                ${isAdmin ? `<button class="delete-location-btn text-red-500" data-id="${b.id}" data-type="box"><i class="fas fa-trash"></i></button>` : ''}
                               </li>`;
                   }).join("") || '<li class="text-gray-500">No boxes found.</li>'}</ul>
                   ${state.currentUser.permissions.location_management ? `<form id="addBoxForm" class="border-t pt-2"><select class="w-full mb-2 px-2 py-1 border rounded" required><option value="">Select Shelf</option>${filteredShelves.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}</select><div class="flex gap-2"><input type="text" class="flex-grow px-2 py-1 border rounded" placeholder="New Box Name" required><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button></div></form>` : ''}
               </div>
          </div>
      </div>
    `;
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

export function renderPartsRequestPage() {
    const partRequests = state.cache.partRequests;

    const buttons = [
        '<button id="refreshDataBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-sync-alt mr-2"></i>Refresh</button>',
        '<button id="printPurchaseListBtn" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-file-invoice mr-2"></i>Print Purchase List</button>',
    ];

    if (state.currentUser.permissions.part_request_create) {
        buttons.push('<button id="storageRequestBtn" class="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-warehouse mr-2"></i>Request from Storage</button>');
        buttons.push('<button id="newPartRequestBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>New Purchase Request</button>');
    }
    
    if (state.currentUser.permissions.part_restock) {
        buttons.push('<button id="receivePartsBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-box-open mr-2"></i>Receive Parts</button>');
        buttons.push('<button id="restockPartsBtn" class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-dolly-flatbed mr-2"></i>Restock Parts</button>');
    }

    const header = renderPageHeader("Part Requests", buttons);

    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
          <input type="text" id="partRequestSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by Part Name, SKU, or Requester...">
          <div class="overflow-x-auto">
              <table class="w-full">
                  <thead>
                      <tr class="border-b">
                          <th class="p-2 text-left cursor-pointer" data-sort="requestDate">Request Date <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="partId">Part Name <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="newPartNumber">Part Number <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="quantity">Quantity <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left cursor-pointer" data-sort="status">Status <i class="fas fa-sort"></i></th>
                          <th class="p-2 text-left">Purpose / Reason</th>
                          <th class="p-2 text-left">Actions</th>
                      </tr>
                  </thead>
                  <tbody id="partRequestTableBody">
                      ${generateTableRows("partRequests", partRequests)}
                  </tbody>
              </table>
          </div>
          <div id="partRequestPagination">
              ${renderPagination('partRequests')}
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
                  <td class="p-2"><input type="checkbox" class="row-checkbox" data-id="${asset.id}"></td>
                  <td class="p-2">${asset.name}</td>
                  <td class="p-2">${asset.tag}</td>
                  <td class="p-2">${getFullLocationName(asset.locationId)}</td>
                  <td class="p-2"><span class="px-2 py-1 text-xs font-semibold rounded-full ${asset.status === "Active" ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-800"}">${asset.status}</span></td>
                  <td class="p-2 space-x-2">
                      <button class="view-asset-btn text-blue-500 hover:text-blue-700" data-id="${asset.id}" title="View Details"><i class="fas fa-eye"></i></button>
                      
                      ${state.currentUser.permissions.asset_edit ? `<button class="edit-asset-btn text-yellow-500 hover:text-yellow-700" data-id="${asset.id}" title="Edit"><i class="fas fa-edit"></i></button>` : ''}
                      
                      ${state.currentUser.permissions.asset_transfer ? `<button class="transfer-asset-btn text-purple-500 hover:text-purple-700" data-id="${asset.id}" title="Transfer"><i class="fas fa-truck"></i></button>` : ''}
                      ${state.currentUser.permissions.asset_delete ? `<button class="delete-asset-btn text-red-500 hover:text-red-700" data-id="${asset.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                      
                      ${asset.status !== "Decommissioned" && state.currentUser.permissions.asset_edit ? `<button class="dispose-asset-btn text-gray-500 hover:text-gray-700" data-id="${asset.id}" title="Dispose"><i class="fas fa-ban"></i></button>` : ""}
                  </td>
              </tr>`).join("");
      
      case "parts":
        const isAdmin = state.currentUser.role === 'Admin';
        return data.map((part) => {
            const departmentCell = isAdmin 
                ? `<td class="p-2">${part.departmentName || 'N/A'}</td>` 
                : '';
            return `
              <tr class="border-b hover:bg-gray-50 ${parseInt(part.quantity) <= parseInt(part.minQuantity) ? "bg-red-100" : ""}">
                  <td class="p-2"><input type="checkbox" class="row-checkbox" data-id="${part.id}"></td>
                  <td class="p-2">${part.name}</td>
                  <td class="p-2">${part.sku}</td>
                  <td class="p-2">${part.quantity} ${parseInt(part.quantity) <= parseInt(part.minQuantity) ? '<span class="text-red-600 font-bold">(Low)</span>' : ""}</td>
                  ${departmentCell}
                  <td class="p-2 space-x-2">
                      <button class="view-part-btn text-blue-500 hover:text-blue-700" data-id="${part.id}" title="View Details"><i class="fas fa-eye"></i></button>
                      <button class="edit-part-btn text-yellow-500 hover:text-yellow-700" data-id="${part.id}" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="delete-part-btn text-red-500 hover:text-red-700" data-id="${part.id}"><i class="fas fa-trash"></i></button>
                  </td>
              </tr>`;
        }).join("");

      case "workOrders":
        const woStatusColors = { Open: "bg-blue-200 text-blue-800", "In Progress": "bg-yellow-200 text-yellow-800", "On Hold": "bg-orange-200 text-orange-800", Delay: "bg-red-200 text-red-800", Completed: "bg-green-200 text-green-800" };
        return data.map((wo) => {
            const assetName = state.cache.assets.find((a) => a.id === parseInt(wo.assetId))?.name || "N/A";
            const statusColorClass = woStatusColors[wo.status] || "bg-gray-200 text-gray-800";
            return `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2"><input type="checkbox" class="row-checkbox" data-id="${wo.id}"></td>
                  <td class="p-2">${wo.title}</td>
                  <td class="p-2">${assetName}</td>
                  <td class="p-2">${wo.start_date}</td>
                  <td class="p-2">${wo.dueDate}</td>
                  <td class="p-2"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}">${wo.status}</span></td>
                  <td class="p-2 space-x-2 whitespace-nowrap">
                      <button class="view-wo-btn text-blue-500 hover:text-blue-700" data-id="${wo.id}" title="View Details"><i class="fas fa-eye"></i></button>
                      ${wo.status !== 'Completed' ? `
                          <button class="edit-wo-btn text-yellow-500 hover:text-yellow-700" data-id="${wo.id}" title="Edit"><i class="fas fa-edit"></i></button>
                          <button class="complete-wo-btn text-green-500 hover:text-green-700" data-id="${wo.id}" title="Complete"><i class="fas fa-check-circle"></i></button>
                      ` : ''}
                      ${state.currentUser.permissions.wo_delete ? `
                          <button class="delete-wo-btn text-red-500 hover:text-red-700" data-id="${wo.id}" title="Delete"><i class="fas fa-trash"></i></button>
                      ` : ''}
                  </td>
              </tr>`;
          }).join("");
      case "users":
        const canEditUsers = state.currentUser.permissions.user_edit;
        return data.map((user) => `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2"><input type="checkbox" class="row-checkbox" data-id="${user.id}"></td>
                  <td class="p-2">${user.fullName}</td>
                  <td class="p-2">${user.username}</td>
                  <td class="p-2">${user.role}</td>
                  <td class="p-2">${getUserDepartment(user)}</td>
                  <td class="p-2 space-x-2">
                      ${
                        canEditUsers && user.id !== 1 ? `
                          <button class="edit-user-btn text-yellow-500 hover:text-yellow-700" data-id="${user.id}" title="Edit Role"><i class="fas fa-user-shield"></i></button>
                      ` : ''}
                      ${
                        state.currentUser.role === 'Admin' && user.id !== state.currentUser.id && user.id !== 1 ? `
                          <button class="delete-user-btn text-red-500 hover:text-red-700" data-id="${user.id}" title="Delete User"><i class="fas fa-trash"></i></button>
                      ` : ""}
                  </td>
              </tr>`).join("");
      
      case "partRequests":
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
            
            const partNumber = part ? part.sku : (req.newPartNumber || 'N/A');

            const statusColorClass = prStatusColors[req.status] || "bg-gray-200 text-gray-800";
            
            const notesOrReason = req.status === 'Rejected' 
                ? `<span class="text-red-600">${req.rejectionReason || 'No reason provided.'}</span>` 
                : req.purpose;
            
            const canEdit = req.requesterId === state.currentUser.id && req.status === 'Requested' && state.currentUser.permissions.part_request_create;
            const canDelete = state.currentUser.permissions.part_request_delete;
            const canApprove = state.currentUser.permissions.part_request_approve && 
                               (req.status === "Requested" || req.status === "Requested from Storage");
            return `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${new Date(req.requestDate).toLocaleDateString()}</td>
                  <td class="p-2">${partName}</td>
                  <td class="p-2">${partNumber}</td>
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
    const { fullName, role, permissions } = state.currentUser;
    document.getElementById("userFullName").textContent = fullName;
    document.getElementById("userRole").textContent = role;
    document.getElementById("userDepartment").textContent = getUserDepartment(state.currentUser);

    const navStructure = [
        { type: 'link', page: "dashboard", icon: "fa-tachometer-alt", text: "Dashboard" },
        { type: 'link', page: "workOrderCalendar", icon: "fa-calendar-alt", text: "Calendar" },
        {
            type: 'group',
            id: 'management',
            title: 'Management',
            icon: 'fa-tasks',
            links: [
                { page: "assets", icon: "fa-box", text: "Assets" },
                { page: "parts", icon: "fa-cogs", text: "Spare Parts" },
                { page: "partRequests", icon: "fa-inbox", text: "Part Requests" },
                { page: "stockTake", icon: "fa-clipboard-check", text: "Stock Take" },
                { page: "workOrders", icon: "fa-clipboard-list", text: "Work Orders" }, 
                { page: "pmSchedules", icon: "fa-calendar-check", text: "PM Schedules" },
                { page: "locations", icon: "fa-map-marker-alt", text: "Locations" },
            ]
        },
        {
            type: 'group',
            id: 'reports',
            title: 'Reports',
            icon: 'fa-chart-pie',
            links: [
                { page: "inventoryReport", icon: "fa-chart-line", text: "Inventory Report" },
                { page: "costReport", icon: "fa-dollar-sign", text: "Cost Report" },
                { page: "kpiReport", icon: "fa-tachometer-alt", text: "KPI Report" },
            ]
        },
        {
            type: 'group',
            id: 'admin',
            title: 'Admin',
            icon: 'fa-cogs',
            links: [
                { page: "userManagement", icon: "fa-users-cog", text: "User Management" },
                { page: "activityLog", icon: "fa-history", text: "Activity Log" },
                { page: "feedback", icon: "fa-envelope-open-text", text: "Team Messages" },
            ]
        }
    ];

    let navHtml = '';
    navStructure.forEach(item => {
        if (item.type === 'link') {
            if (can.viewPage(item.page)) {
                navHtml += `
                    <a href="#" class="nav-link flex items-center p-2 rounded-lg hover:bg-gray-700 ${state.currentPage === item.page ? "bg-gray-900" : ""}" data-page="${item.page}">
                        <i class="fas ${item.icon} w-6 text-center"></i><span class="ml-3">${item.text}</span>
                    </a>`;
            }
        } else if (item.type === 'group') {
            const visibleLinks = item.links.filter(link => can.viewPage(link.page));
            if (visibleLinks.length > 0) {
                const isOpen = state.sidebarSections[item.id];
                navHtml += `
                    <div>
                        <button type="button" class="sidebar-section-toggle flex items-center w-full p-2 text-base font-normal text-white rounded-lg hover:bg-gray-700" data-section-id="${item.id}">
                            <i class="fas ${item.icon} w-6 text-center"></i>
                            <span class="flex-1 ml-3 text-left whitespace-nowrap">${item.title}</span>
                            <i class="fas fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}"></i>
                        </button>
                        <ul class="py-2 space-y-2 ${!isOpen ? 'hidden' : ''}">
                            ${visibleLinks.map(link => `
                                <li>
                                    <a href="#" class="nav-link flex items-center p-2 pl-11 w-full text-base font-normal rounded-lg hover:bg-gray-700 ${state.currentPage === link.page ? "bg-gray-900" : ""}" data-page="${link.page}">
                                        <i class="fas ${link.icon} w-6 text-center"></i><span class="ml-3">${link.text}</span>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
        }
    });

    const navMenu = document.getElementById("navMenu");
    navMenu.innerHTML = navHtml;

    const sidebarFooter = document.getElementById("sidebar-footer");
    if (!sidebarFooter.querySelector('#sendFeedbackBtn')) {
        sidebarFooter.insertAdjacentHTML('afterbegin', `
            <button id="sendFeedbackBtn" class="w-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors mb-2">
                <i class="fas fa-comment-dots mr-2"></i> Send Feedback
            </button>
        `);
    }

    const userInfo = document.getElementById("userInfo");
    if (!userInfo.querySelector('#notificationBellBtn')) {
        userInfo.querySelector('.flex.justify-between').innerHTML += `
            <div class="relative">
                <button id="notificationBellBtn" class="relative text-gray-400 hover:text-white">
                    <i class="fas fa-bell fa-lg"></i>
                    <span id="notificationBadge" class="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center border-2 border-gray-800 hidden"></span>
                </button>
            </div>
        `;
    }
}

export function showAssetModal(assetId = null) {
    const form = document.getElementById("assetForm");
    form.reset();
    document.getElementById("assetId").value = "";
    populateLocationDropdown(document.getElementById("assetLocation"), "operational");

    const partSelect = document.getElementById("assetRelatedParts");
    partSelect.innerHTML = '';

    state.cache.parts.forEach(part => {
        const option = document.createElement('option');
        option.value = part.id;
        option.textContent = `${part.name} (SKU: ${part.sku})`;
        partSelect.appendChild(option);
    });

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

            if (asset.relatedParts) {
                Array.from(partSelect.options).forEach(option => {
                    if (asset.relatedParts.includes(option.value)) {
                        option.selected = true;
                    }
                });
            }
        }
    } else {
        document.getElementById("assetModalTitle").textContent = "Add Asset";
    }
    document.getElementById("assetModal").style.display = "flex";
}

export function showAssetDetailModal(asset) {
    if (!asset) return;
    const contentEl = document.getElementById('assetDetailContent');
    const locationName = getFullLocationName(asset.locationId);
    
    const relatedParts = state.cache.parts.filter(part => 
        part.relatedAssets && part.relatedAssets.includes(asset.id.toString())
    );

    const transferHistory = state.cache.logs.filter(log => 
        log.action === "Asset Transferred" && log.details.includes(asset.name)
    );

    const workOrderHistory = state.cache.workOrders
        .filter(wo => wo.assetId === asset.id)
        .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

    const workOrderHistoryHtml = `
        <h3 class="text-lg font-bold mt-6 mb-2">Work Order History</h3>
        <div class="bg-gray-50 p-3 rounded-md text-sm max-h-48 overflow-y-auto">
            ${workOrderHistory.length > 0 ? `
                <table class="w-full">
                    <thead>
                        <tr class="border-b">
                            <th class="p-1 text-left">Title</th>
                            <th class="p-1 text-left">Status</th>
                            <th class="p-1 text-left">Due Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${workOrderHistory.map(wo => `
                            <tr class="border-b hover:bg-gray-100">
                                <td class="p-1">${wo.title}</td>
                                <td class="p-1">${wo.status}</td>
                                <td class="p-1">${wo.dueDate}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : `<p class="text-gray-500">No work order history found for this asset.</p>`}
        </div>
    `;
    
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
        
        ${workOrderHistoryHtml}
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
    
    const assetSelect = document.getElementById("partRelatedAssets");
    assetSelect.innerHTML = '';
    state.cache.assets.filter(can.view).forEach(asset => {
        const option = document.createElement('option');
        option.value = asset.id;
        option.textContent = `${asset.name} (Tag: ${asset.tag})`;
        assetSelect.appendChild(option);
    });

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
    document.getElementById("woAsset").innerHTML = '<option value="">Select Asset</option>' + assets.map((a) => `<option value="${a.id}">${a.name} (${getFullLocationName(a.locationId)})</option>`).join("");
        // Start with the users already loaded from the backend
    let users = state.cache.users.filter((u) => can.view(u));

    // Check if the current user is not in the list (e.g., if their department is unique)
    if (!users.some(user => user.id === state.currentUser.id)) {
        users.push(state.currentUser);
    }

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
            document.getElementById("woStartDate").value = wo.start_date;
            document.getElementById("woDueDate").value = wo.dueDate;
            document.getElementById("woBreakdownTime").value = wo.breakdownTimestamp || "";
            document.getElementById("woPriority").value = wo.priority;
            document.getElementById("woStatus").value = wo.status;
            if (wo.checklist && wo.checklist.length > 0) {
                wo.checklist.forEach((item) => addChecklistItem(item.text, 'woChecklistContainer'));
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

export async function showEditUserModal(userId) {
    const user = state.cache.users.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('editUserModal');
    const roleSelect = document.getElementById('editUserRole');
    const permissionsContainer = document.getElementById('userPermissionsContainer');

    const allRoles = ['Manager', 'Supervisor', 'Engineer', 'Technician', 'Clerk'];
    const availableRoles = state.currentUser.role === 'Admin' ? ['Admin', ...allRoles] : allRoles;

    roleSelect.innerHTML = availableRoles.map(role => `<option value="${role}">${role}</option>`).join('');

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserFullName').textContent = user.fullName;
    roleSelect.value = user.role;
    
    permissionsContainer.innerHTML = '<p>Loading permissions...</p>';
    modal.style.display = 'flex';

    try {
        const [permissionData, userPermissions] = await Promise.all([
            api.getPermissions(),
            api.getUserPermissions(userId)
        ]);
        
        const allPermissions = permissionData.all;
        const roleDefaults = permissionData.roles;

        let permissionsHtml = '';
        for (const key in allPermissions) {
            const label = allPermissions[key];
            const isChecked = userPermissions[key] ? 'checked' : '';
            permissionsHtml += `
                <div class="relative flex items-start">
                    <div class="flex h-5 items-center">
                        <input id="perm-${key}" name="permissions" data-key="${key}" type="checkbox" ${isChecked} class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    </div>
                    <div class="ml-3 text-sm">
                        <label for="perm-${key}" class="font-medium text-gray-700">${label}</label>
                    </div>
                </div>
            `;
        }
        permissionsContainer.innerHTML = permissionsHtml;

        roleSelect.addEventListener('change', (e) => {
            const newRole = e.target.value;
            const newRoleDefaults = roleDefaults[newRole] || [];
            
            document.querySelectorAll('#userPermissionsContainer input[type="checkbox"]').forEach(checkbox => {
                const permissionKey = checkbox.dataset.key;
                checkbox.checked = newRoleDefaults.includes(permissionKey);
            });
        });

    } catch (error) {
        permissionsContainer.innerHTML = `<p class="text-red-500">Error loading permissions: ${error.message}</p>`;
    }
}

export function addChecklistItem(text, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const itemDiv = document.createElement("div");
    itemDiv.className = "flex items-center gap-2 checklist-item";
    itemDiv.innerHTML = `
        <span class="flex-grow p-2 bg-gray-100 rounded">${text}</span>
        <button type="button" class="remove-checklist-item-btn text-red-500 hover:text-red-700">
            <i class="fas fa-trash"></i>
        </button>
    `;
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
    
    document.getElementById('completeWorkOrderId').value = workOrder.id;
    document.getElementById('completeWoTitle').textContent = workOrder.title;

    const checklistContainer = document.getElementById('completeWoChecklist');
    checklistContainer.innerHTML = '';
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

    document.getElementById('completionNotes').value = '';
    document.getElementById('completeWorkOrderModal').style.display = 'flex';
}

export function showPartDetailModal(part) {
    if (!part) return;
    const contentEl = document.getElementById('partDetailContent');
    const locationName = getFullLocationName(part.locationId);
    
    const relatedAssetIds = (part.relatedAssets || []).map(id => Number(id));

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
    const partSelect = document.getElementById('requestPartId');
    partSelect.innerHTML = state.cache.parts
        .map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('');

    const assetSelect = document.getElementById('requestAssetId');
    const viewableAssets = state.cache.assets.filter(can.view);
    assetSelect.innerHTML = '<option value="">None / General Purpose</option>' + viewableAssets
        .map(a => `<option value="${a.id}">${a.name} (Tag: ${a.tag})</option>`).join('');

    const checkbox = document.getElementById('requestNewPartCheckbox');
    const newPartContainer = document.getElementById('newPartContainer');
    const existingPartContainer = document.getElementById('existingPartContainer');
    checkbox.addEventListener('change', () => {
        newPartContainer.classList.toggle('hidden', !checkbox.checked);
        existingPartContainer.classList.toggle('hidden', checkbox.checked);
    });
    checkbox.checked = false;
    newPartContainer.classList.add('hidden');
    existingPartContainer.classList.remove('hidden');

    document.getElementById('partRequestModal').style.display = 'flex';
}

export async function showStorageRequestModal() {
    try {
        showTemporaryMessage("Loading latest part quantities...");
        const allPartsResponse = await api.getAllParts(); // Use the new function
        state.cache.parts = allPartsResponse.data;
    } catch (error) {
        showTemporaryMessage("Could not load latest parts list.", true);
        return;
    }

    const partSelect = document.getElementById('storageRequestPartId');
    partSelect.innerHTML = '<option value="">Select a part...</option>' + state.cache.parts
       .filter(p => p.quantity > 0)
       .map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku}) (In Stock: ${p.quantity})</option>`).join('');
   
   const assetSelect = document.getElementById('storageRequestAssetId');
   const viewableAssets = state.cache.assets.filter(can.view);
   assetSelect.innerHTML = '<option value="">None / General Purpose</option>' + viewableAssets
       .map(a => `<option value="${a.id}">${a.name} (Tag: ${a.tag})</option>`).join('');

   document.getElementById('storageRequestModal').style.display = 'flex';
}

export async function showReceivePartsModal() {
    const requestSelect = document.getElementById('receiveRequestId');
    const approvedRequests = state.cache.partRequests.filter(pr => pr.status === 'Approved' && can.view(pr));
    requestSelect.innerHTML = '<option value="">Select an approved request...</option>' + approvedRequests.map(pr => {
        const partName = pr.newPartName || state.cache.parts.find(p => p.id === pr.partId)?.name;
        return `<option value="${pr.id}">Request #${pr.id} - ${pr.quantity} x ${partName}</option>`
    }).join('');
    document.getElementById('receivePartsModal').style.display = 'flex';
}

export async function showRestockPartsModal() {
    try {
        showTemporaryMessage("Loading received parts...");
        const [receivedParts, allPartsResponse] = await Promise.all([
            api.getReceivedParts(),
            api.getAllParts()
        ]);
        state.cache.receivedParts = receivedParts;
        state.cache.parts = allPartsResponse.data;
    } catch (error) {
        showTemporaryMessage("Failed to load parts data.", true);
        return;
    }

    const requestSelect = document.getElementById('restockPartId');
    requestSelect.innerHTML = '<option value="">Select received parts...</option>' + state.cache.receivedParts.map(rp => {
        const part = rp.partId ? state.cache.parts.find(p => p.id === rp.partId) : null;
        // If the part is found, use its name. Otherwise, use the newPartName, or a fallback message.
        const partName = part ? part.name : (rp.newPartName || `[Deleted Part ID: ${rp.partId}]`);
        return `<option value="${rp.id}">Received #${rp.id} - ${rp.quantity} x ${partName}</option>`
    }).join('');

    const directPartSelect = document.getElementById('directStockPartId');
    directPartSelect.innerHTML = '<option value="">Select an existing part...</option>' + state.cache.parts
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

        restockPartIdInput.required = isRequestMode;
        restockPartIdInput.disabled = !isRequestMode;

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
export function populateLocationDropdowns(divisionSelect, departmentSelect, data = null) {
    const locationData = data || state.cache.locations;
    const { divisions = [], departments = [] } = locationData || {};

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
        <div id="reportResultContainer" class="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div class="lg:col-span-3 bg-white p-4 rounded-lg shadow">
                <div id="reportTableContainer">
                    <p class="text-gray-500">Please select a date range and click "Generate Report".</p>
                </div>
            </div>
            <div class="lg:col-span-2 bg-white p-4 rounded-lg shadow">
                <h2 class="text-xl font-bold mb-4">Top 10 Most Valuable Parts</h2>
                <div id="inventoryChartContainer" style="height: 400px;">
                    <canvas id="inventoryChart"></canvas>
                </div>
            </div>
        </div>
    `;
}

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
    const partNumber = part ? part.sku : (req.newPartNumber || 'N/A');

    contentEl.innerHTML = `
        <p><strong>Part:</strong> ${partName}</p>
        <p><strong>Part Number/SKU:</strong> ${partNumber}</p> <p><strong>Quantity:</strong> ${req.quantity}</p>
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
    
    const modal = document.getElementById('partRequestModal');
    modal.querySelector('h2').textContent = 'Edit Part Request';
    
    const form = document.getElementById('partRequestForm');
    form.reset();

    document.getElementById('requestNewPartCheckbox').closest('div').style.display = 'none';
    document.getElementById('newPartContainer').classList.add('hidden');
    document.getElementById('existingPartContainer').classList.remove('hidden');

    document.getElementById('partRequestId').value = req.id;
    document.getElementById('requestPartId').value = req.partId;
    document.getElementById('requestQuantity').value = req.quantity;
    document.getElementById('requestPurpose').value = req.purpose;

    modal.style.display = 'flex';
}

export function renderPmSchedulesPage() {
    const schedules = state.cache.pmSchedules || [];
    const openWorkOrders = state.cache.workOrders.filter(wo => wo.status === 'Open' && wo.wo_type === 'PM');

    schedules.sort((a, b) => {
        const dateA_str = a.last_generated_date || a.schedule_start_date || '1970-01-01';
        const dateB_str = b.last_generated_date || b.schedule_start_date || '1970-01-01';
        const dateA = new Date(dateA_str);
        const dateB = new Date(dateB_str);
        return dateB - dateA;
    });

    const header = renderPageHeader("Preventive Maintenance Schedules", [
        '<button id="generatePmWoBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-cogs mr-2"></i>Generate PM Work Orders</button>',
        '<button id="addPmScheduleBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Add PM Schedule</button>'
    ]);
    const statusColors = { 
        "Active": "bg-green-200 text-green-800",
        "Inactive": "bg-gray-200 text-gray-800",
        "Open": "bg-blue-200 text-blue-800", 
        "In Progress": "bg-yellow-200 text-yellow-800", 
        "On Hold": "bg-orange-200 text-orange-800", 
        "Delay": "bg-red-200 text-red-800", 
    };
    
    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
        <input type="text" id="pmScheduleSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by Schedule Title or Asset Name...">
        <table class="w-full">
          <thead><tr class="border-b">
            <th class="p-2 text-left cursor-pointer" data-sort="title">Schedule Title <i class="fas fa-sort"></i></th>
            <th class="p-2 text-left cursor-pointer" data-sort="assetId">Asset <i class="fas fa-sort"></i></th>
            <th class="p-2 text-left cursor-pointer" data-sort="frequency_interval">Frequency <i class="fas fa-sort"></i></th>
            <th class="p-2 text-left">Next Start Date</th>
            <th class="p-2 text-left">Next Due Date</th>
            <th class="p-2 text-left">Following PM Date</th>
            <th class="p-2 text-left cursor-pointer" data-sort="is_active">Status <i class="fas fa-sort"></i></th>
            <th class="p-2 text-left">Actions</th>
          </tr></thead>
          <tbody id="pmSchedulesTableBody">
            ${schedules.map(s => {
                const assetName = state.cache.assets.find(a => a.id === s.assetId)?.name || 'N/A';
                const openWoForSchedule = openWorkOrders.find(wo => wo.pm_schedule_id === s.id);
                
                let nextStartDateStr = calculateNextPmDate(s);
                let nextDueDateStr = 'N/A';
                let status = s.is_active ? 'Active' : 'Inactive';
                
                if (openWoForSchedule) {
                    nextStartDateStr = openWoForSchedule.start_date;
                    nextDueDateStr = openWoForSchedule.dueDate;
                    status = openWoForSchedule.status;
                } else if (s.is_active) {
                    const nextStartDate = new Date(nextStartDateStr + 'T00:00:00');
                    if (!isNaN(nextStartDate.getTime())) {
                        const bufferDays = s.due_date_buffer || 7;
                        nextStartDate.setDate(nextStartDate.getDate() + bufferDays);
                        nextDueDateStr = nextStartDate.toISOString().split('T')[0];
                    }
                }
                
                const followingPmDate = calculateNextPmDate({ ...s, last_generated_date: nextStartDateStr });
                const statusColorClass = statusColors[status] || 'bg-gray-200';

                const frequencyText = `${s.frequency_interval} ${s.frequency_unit}(s)`;

                return `<tr class="border-b hover:bg-gray-50">
                    <td class="p-2">${s.title}</td>
                    <td class="p-2">${assetName}</td>
                    <td class="p-2">${frequencyText}</td>
                    <td class="p-2 font-semibold">${nextStartDateStr || 'N/A'}</td>
                    <td class="p-2 font-semibold">${nextDueDateStr}</td>
                    <td class="p-2">${followingPmDate}</td>
                    <td class="p-2"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}">${status}</span></td>
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
    
    document.getElementById("pmChecklistContainer").innerHTML = "";
    document.getElementById("pmPartsContainer").innerHTML = "";
    
    const modalTitle = document.querySelector("#pmScheduleModal h2");
    
    document.getElementById("pmScheduleId").value = "";
    document.getElementById("pmStartDate").value = new Date().toISOString().split('T')[0];
    document.getElementById('pmIsActive').checked = true;
    document.getElementById("pmFrequencyInterval").value = 1;
    document.getElementById("pmFrequencyUnit").value = "Week";
    document.getElementById("pmDueDateBuffer").value = "";

    const assets = state.cache.assets.filter(can.view);
    document.getElementById("pmAsset").innerHTML = '<option value="">Select Asset</option>' + assets.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
    const users = state.cache.users.filter((u) => ["Engineer", "Technician", "Supervisor"].includes(u.role) && can.view(u));
    document.getElementById("pmAssignedTo").innerHTML = '<option value="">Assign To</option>' + users.map((u) => `<option value="${u.id}">${u.fullName}</option>`).join("");

    if (schedule) {
        modalTitle.textContent = "Edit PM Schedule";
        document.getElementById("pmScheduleId").value = schedule.id;
        document.getElementById("pmTitle").value = schedule.title;
        document.getElementById("pmStartDate").value = schedule.schedule_start_date;
        document.getElementById("pmFrequencyInterval").value = schedule.frequency_interval;
        document.getElementById("pmFrequencyUnit").value = schedule.frequency_unit;
        document.getElementById("pmDueDateBuffer").value = schedule.due_date_buffer || "";
        document.getElementById("pmAsset").value = schedule.assetId;
        document.getElementById("pmAssignedTo").value = schedule.assignedTo;
        document.getElementById("pmTask").value = schedule.task;
        document.getElementById("pmDescription").value = schedule.description;
        document.getElementById('pmIsActive').checked = !!schedule.is_active;

        if (schedule.checklist && schedule.checklist.length > 0) {
            schedule.checklist.forEach(item => addChecklistItem(item.text, 'pmChecklistContainer'));
        }
        if (schedule.requiredParts && schedule.requiredParts.length > 0) {
            schedule.requiredParts.forEach(part => addPmPartRow(part.partId, part.quantity));
        }

    } else {
        modalTitle.textContent = "New PM Schedule";
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
    
    const frequencyText = `${schedule.frequency_interval} ${schedule.frequency_unit}(s)`;
    const nextPmDate = calculateNextPmDate(schedule);

    contentEl.innerHTML = `
        <p><strong>Title:</strong> ${schedule.title}</p>
        <p><strong>Asset:</strong> ${asset?.name || 'N/A'}</p>
        <p><strong>Status:</strong> ${schedule.is_active ? 'Active' : 'Inactive'}</p>
        <hr class="my-2">
        <p><strong>Frequency:</strong> ${frequencyText}</p>
        <p><strong>Schedule Start Date:</strong> ${schedule.schedule_start_date}</p>
        <p><strong>Last Generated:</strong> ${schedule.last_generated_date || 'Never'}</p>
        <p class="font-bold"><strong>Next PM Date:</strong> ${nextPmDate}</p>
        <hr class="my-2">
        <p><strong>Assigned To:</strong> ${assignedUser?.fullName || 'N/A'}</p>
        <p><strong>Task Type:</strong> ${schedule.task}</p>
        <p><strong>Description:</strong> ${schedule.description || 'None'}</p>
    `;
    document.getElementById('pmScheduleDetailModal').style.display = 'flex';
}

export function addPmPartRow(selectedPartId = "", quantity = 1) {
    const container = document.getElementById("pmPartsContainer");
    const allParts = state.cache.parts.filter(can.view);
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 pm-part-row mt-2";
    
    const select = document.createElement("select");
    select.className = "w-2/3 px-3 py-2 border rounded pm-part-select";
    select.innerHTML = '<option value="">Select a part...</option>' + allParts.map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join("");
    if (selectedPartId) select.value = selectedPartId;

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.className = "w-1/3 px-3 py-2 border rounded pm-part-qty";
    qtyInput.value = quantity;
    qtyInput.min = 1;
    qtyInput.placeholder = "Qty";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-pm-part-btn text-red-500 hover:text-red-700";
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    
    row.appendChild(select);
    row.appendChild(qtyInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
}

export function showUploadModal(type) {
    const modal = document.getElementById('uploadModal');
    const title = document.getElementById('uploadModalTitle');
    const downloadLink = document.getElementById('templateDownloadLink');
    const instructions = document.getElementById('uploadInstructions');
    const resultDiv = document.getElementById('uploadResult');

    instructions.style.display = 'block';
    resultDiv.style.display = 'none';
    resultDiv.innerHTML = '';
    
    if (type === 'assets') {
        title.textContent = 'Upload Assets File';
        downloadLink.href = 'data:text/csv;charset=utf-8,tag,name,category,locationId,purchaseDate,cost,currency,status';
        downloadLink.download = 'assets_template.csv';
    } else if (type === 'parts') {
        title.textContent = 'Upload Spare Parts File';
        downloadLink.href = 'data:text/csv;charset=utf-8,sku,name,category,quantity,minQuantity,locationId,maker,supplier,price,currency';
        downloadLink.download = 'parts_template.csv';
    }

    modal.style.display = 'flex';
}

export function renderStockTakePage() {
    const header = renderPageHeader("Stock Take Sessions", [
        '<button id="startStockTakeBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-plus mr-2"></i>Start New Stock Take</button>'
    ]);
    const sessions = state.cache.stockTakes || [];
    
    const statusColors = { 
        "In Progress": "bg-yellow-200 text-yellow-800", 
        "Pending Approval": "bg-blue-200 text-blue-800",
        "Completed": "bg-green-200 text-green-800",
    };

    return `
      ${header}
      <div class="bg-white p-4 rounded-lg shadow">
        <input type="text" id="stockTakeSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by Session ID or Creator Name...">
        <table class="w-full">
          <thead><tr class="border-b">
            <th class="p-2 text-left cursor-pointer" data-sort="id">Session ID <i class="fas fa-sort"></i></th>
            <th class="p-2 text-left cursor-pointer" data-sort="status">Status <i class="fas fa-sort"></i></th>
            <th class="p-2 text-left cursor-pointer" data-sort="creator_name">Created By <i class="fas fa-sort"></i></th>
            <th class="p-2 text-left cursor-pointer" data-sort="creation_date">Date <i class="fas fa-sort"></i></th>
            <th class="p-2 text-left">Actions</th>
          </tr></thead>
          <tbody id="stockTakeTableBody">
            ${sessions.map(s => `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-2">#${s.id}</td>
                    <td class="p-2"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColors[s.status] || 'bg-gray-200'}">${s.status}</span></td>
                    <td class="p-2">${s.creator_name}</td>
                    <td class="p-2">${new Date(s.creation_date).toLocaleDateString()}</td>
                    <td class="p-2 space-x-2">
                        <button class="view-stock-take-btn text-blue-500 hover:text-blue-700" data-id="${s.id}" title="View/Edit"><i class="fas fa-eye"></i></button>
                        
                        ${state.currentUser.permissions.stock_take_delete ? `
                            <button class="delete-stock-take-btn text-red-500 hover:text-red-700" data-id="${s.id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                        </td>
                </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
}

export function renderStockTakeCountPage(items, details) {
    const canApprove = state.currentUser.permissions.stock_take_approve;
    const isPending = details.status === 'Pending Approval';
    const isInProgress = details.status === 'In Progress';

    let buttons = [
        '<button id="printStockTakeBtn" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-print mr-2"></i>Print Count Sheet</button>'
    ];
    
    if (isInProgress) {
        buttons.push('<button id="saveStockTakeProgressBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-save mr-2"></i>Save Progress</button>');
        buttons.push('<button id="submitStockTakeBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Submit for Review</button>');
    }
    if (isPending && canApprove) {
        buttons.push('<button id="approveStockTakeBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-check mr-2"></i>Approve & Adjust Inventory</button>');
    }
    
    const header = `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold page-header-title" data-id="${details.id}">Stock Take Session #${details.id}</h1>
          <div class="space-x-2">
              ${buttons.join('\n')}
          </div>
      </div>
    `;

    return `
        ${header}
        <div class="bg-white p-4 rounded-lg shadow">
            <input type="text" id="stockTakeSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by Part Name or SKU...">
            <table class="w-full">
                <thead><tr class="border-b">
                    <th class="p-2 text-left cursor-pointer" data-sort="name">Part Name <i class="fas fa-sort"></i></th>
                    <th class="p-2 text-left cursor-pointer" data-sort="sku">SKU <i class="fas fa-sort"></i></th>
                    <th class="p-2 text-right cursor-pointer" data-sort="system_qty">System Qty <i class="fas fa-sort"></i></th>
                    <th class="p-2 text-center">Physical Qty</th>
                    <th class="p-2 text-right cursor-pointer" data-sort="variance">Variance <i class="fas fa-sort"></i></th>
                </tr></thead>
                <tbody id="stockTakeItemsContainer">
                    ${items.map(item => {
                        const variance = (item.counted_qty !== null && item.counted_qty !== '') ? parseInt(item.counted_qty) - item.system_qty : '';
                        const varianceColor = variance > 0 ? 'text-green-600' : (variance < 0 ? 'text-red-600' : '');
                        return `
                        <tr class="border-b">
                            <td class="p-2">${item.name}</td>
                            <td class="p-2">${item.sku}</td>
                            <td class="p-2 text-right">${item.system_qty}</td>
                            <td class="p-2 w-32">
                                <input type="number" data-id="${item.id}" value="${item.counted_qty !== null ? item.counted_qty : ''}" 
                                class="w-full text-center border rounded px-1 py-0.5 stock-take-qty-input" ${!isInProgress ? 'disabled' : ''}>
                            </td>
                            <td class="p-2 text-right font-bold ${varianceColor}">${variance}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export function showMessageModal() {
    const form = document.getElementById('messageForm');
    form.reset();
    
    const targetRoleContainer = document.getElementById('messageTargetRoleContainer');
    const targetDeptContainer = document.getElementById('messageTargetDeptContainer');
    const currentUserRole = state.currentUser.role;

    // Logic to show/hide the role selector
    if (['Admin', 'Manager', 'Supervisor'].includes(currentUserRole)) {
        targetRoleContainer.style.display = 'block';
    } else {
        targetRoleContainer.style.display = 'none';
    }

    // Logic for Admin's department selector
    if (currentUserRole === 'Admin') {
        targetDeptContainer.style.display = 'block';
        const deptSelect = document.getElementById('messageTargetDept');
        deptSelect.innerHTML = '<option value="">Your Department (Default)</option>' +
            (state.cache.locations.departments || [])
            .map(d => `<option value="${d.id}">${d.name}</option>`)
            .join('');
    } else {
        targetDeptContainer.style.display = 'none';
    }

    document.getElementById('messageModal').style.display = 'flex';
}

export function renderTeamMessagesPage() {
    const header = renderPageHeader("Team Messages", [
        '<button id="refreshDataBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-sync-alt mr-2"></i>Refresh</button>',
        '<button id="newMessageBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"><i class="fas fa-paper-plane mr-2"></i>Send New Message</button>',
        // This button will toggle between the inbox and the archive
        `<button id="toggleArchivedFeedbackBtn" class="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded">
            ${state.showArchivedFeedback ? '<i class="fas fa-inbox mr-2"></i>Show Inbox' : '<i class="fas fa-archive mr-2"></i>Show Archived'}
        </button>`
    ]);

    // Filter messages based on whether we are viewing the archive or the inbox
    const messages = (state.cache.feedback || []).filter(item => {
        return state.showArchivedFeedback ? item.status === 'Archived' : item.status !== 'Archived';
    });

    const isAdmin = state.currentUser.role === 'Admin';

    // Admin settings section for enabling/disabling the feature
    const adminSettings = isAdmin ? `
        <div class="bg-white p-4 rounded-lg shadow mb-6">
            <h3 class="text-lg font-bold mb-2">Admin Controls</h3>
            <div class="flex items-center">
                <label for="messagingToggle" class="mr-4">Team Messaging Feature:</label>
                <input type="checkbox" id="messagingToggle" class="h-6 w-6" ${state.settings.is_messaging_enabled === '1' ? 'checked' : ''}>
                <span class="ml-2 text-sm text-gray-600">${state.settings.is_messaging_enabled === '1' ? 'Enabled' : 'Disabled'}</span>
            </div>
        </div>
    ` : '';

    return `
        ${header}
        ${adminSettings}
        <div class="space-y-2" id="message-list-container">
        ${messages.map(item => {
            const isUnread = item.status === 'New';
            const senderInfo = isAdmin ? `<p class="text-xs text-gray-500">${item.department_name || 'N/A'}</p>` : '';
            return `
            <div class="message-item bg-white rounded-lg shadow overflow-hidden" data-id="${item.id}" data-status="${item.status}">
                <div class="message-header p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 ${isUnread ? 'font-bold' : ''}">
                    <div class="flex items-center">
                        <span class="w-2 h-2 ${isUnread ? 'bg-blue-500' : ''} rounded-full mr-3 flex-shrink-0"></span>
                        <div class="flex-grow">
                            <p>${item.sender_name || 'Unknown User'}</p>
                            ${senderInfo}
                        </div>
                    </div>
                    <div class="text-right text-sm text-gray-500 flex items-center flex-shrink-0 ml-4">
                        <span>${new Date(item.timestamp).toLocaleString()}</span>
                        <i class="fas fa-chevron-down ml-4 transition-transform"></i>
                    </div>
                </div>
                <div class="message-body hidden p-4 border-t border-gray-200">
                    <p class="text-gray-800 whitespace-pre-wrap mb-4">${item.message}</p>
                    <div class="flex justify-end items-center space-x-2">
                        ${item.status !== 'Archived' ? `<button class="feedback-status-btn bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-1 px-2 rounded" data-id="${item.id}" data-status="Archived">Archive</button>` : ''}
                        ${item.status === 'New' ? `<button class="feedback-status-btn bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs py-1 px-2 rounded" data-id="${item.id}" data-status="Read">Mark as Read</button>` : ''}
                        ${state.currentUser.permissions.feedback_delete ? `<button class="feedback-delete-btn bg-red-100 hover:bg-red-200 text-red-700 text-xs py-1 px-2 rounded" data-id="${item.id}">Delete</button>` : ''}
                    </div>
                </div>
            </div>
        `}).join('') || `<p class="text-center text-gray-500 py-8">${state.showArchivedFeedback ? 'No archived messages.' : 'Your inbox is empty.'}</p>`}
        </div>
    `;
}

export function renderStatusChart(statusCounts) {
    const ctx = document.getElementById('woStatusChart');
    if (!ctx) return;

    if (state.charts.statusChart) {
        state.charts.statusChart.destroy();
    }
    
    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);

    const chartColors = {
        'Open': '#3B82F6',
        'In Progress': '#F59E0B',
        'On Hold': '#F97316',
        'Completed': '#16A34A',
        'Delay': '#EF4444',
    };
    
    state.charts.statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Work Orders',
                data: data,
                backgroundColor: labels.map(label => chartColors[label] || '#6B7280'),
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                datalabels: {
                    color: '#fff',
                    textAlign: 'center',
                    font: {
                        weight: 'bold',
                        size: 14,
                    },
                    formatter: (value, context) => {
                        const label = context.chart.data.labels[context.dataIndex];
                        if (value === 0) {
                            return null;
                        }
                        return `${label}\n${value}`;
                    }
                }
            }
        }
    });
}

export function renderCostReportPage() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    return `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Maintenance Cost Report</h1>
        </div>
        <div class="bg-white p-4 rounded-lg shadow mb-6">
            <form id="costReportForm" class="flex items-end gap-4">
                <div>
                    <label for="startDate" class="block text-sm font-medium text-gray-700">Start Date</label>
                    <input type="date" id="startDate" value="${firstDayOfMonth}" class="mt-1 px-3 py-2 border rounded w-full">
                </div>
                <div>
                    <label for="endDate" class="block text-sm font-medium text-gray-700">End Date</label>
                    <input type="date" id="endDate" value="${todayStr}" class="mt-1 px-3 py-2 border rounded w-full">
                </div>
                <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Generate Report</button>
            </form>
        </div>
        <div id="reportResultContainer" class="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div class="lg:col-span-3 bg-white p-4 rounded-lg shadow">
                <div id="costTableContainer">
                     <p class="text-gray-500">Please select a date range and click "Generate Report".</p>
                </div>
            </div>
            <div class="lg:col-span-2 bg-white p-4 rounded-lg shadow">
                <h2 class="text-xl font-bold mb-4">Cost Breakdown by Department</h2>
                <div id="costChartContainer" style="height: 400px;">
                    <canvas id="costChart"></canvas>
                </div>
            </div>
        </div>
    `;
}

export function renderKpiReportPage() {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    return `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Maintenance KPI Report</h1>
        </div>
        <div class="bg-white p-4 rounded-lg shadow mb-6">
            <form id="kpiReportForm" class="flex items-end gap-4">
                <div>
                    <label for="startDate" class="block text-sm font-medium text-gray-700">Start Date</label>
                    <input type="date" id="startDate" value="${firstDayOfYear}" class="mt-1 px-3 py-2 border rounded w-full">
                </div>
                <div>
                    <label for="endDate" class="block text-sm font-medium text-gray-700">End Date</label>
                    <input type="date" id="endDate" value="${todayStr}" class="mt-1 px-3 py-2 border rounded w-full">
                </div>
                <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Generate Report</button>
            </form>
        </div>
        <div id="reportResultContainer">
            <p class="text-gray-500">Please select a date range and click "Generate Report" to view KPIs.</p>
        </div>
    `;
}

export function renderInventoryChart(reportData) {
    const ctx = document.getElementById('inventoryChart');
    if (!ctx) return;

    if (state.charts.inventoryChart) {
        state.charts.inventoryChart.destroy();
    }

    const topParts = reportData
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 10);

    const labels = topParts.map(item => item.name);
    const data = topParts.map(item => item.total_value);

    state.charts.inventoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Value (RM)',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Value (RM)'
                    }
                }
            }
        }
    });
}

export function renderCostChart(reportData) {
    const ctx = document.getElementById('costChart');
    if (!ctx) return;

    if (state.charts.costChart) {
        state.charts.costChart.destroy();
    }

    const costsByDept = reportData.reduce((acc, item) => {
        const dept = item.departmentName || 'Uncategorized';
        acc[dept] = (acc[dept] || 0) + item.totalCost;
        return acc;
    }, {});

    const labels = Object.keys(costsByDept);
    const data = Object.values(costsByDept);

    state.charts.costChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Cost (RM)',
                data: data,
                backgroundColor: [
                    'rgba(239, 68, 68, 0.7)',
                    'rgba(59, 130, 246, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(139, 92, 246, 0.7)',
                    'rgba(236, 72, 153, 0.7)',
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MYR' }).format(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

export async function showNotificationModal() {
    const modal = document.getElementById('notificationModal');
    const list = document.getElementById('notificationList');
    list.innerHTML = '<p class="p-4 text-sm text-gray-500">Loading notifications...</p>';
    modal.style.display = 'flex';

    try {
        const notifications = await api.getNotifications(); // This now fetches all types
        if (notifications && notifications.length > 0) {
            list.innerHTML = notifications.map(notif => {
                let message = '';
                if (notif.type === 'team_message') {
                    message = `<strong>${notif.message}</strong> in the Team Messages inbox.`;
                } else if (notif.type === 'part_request_update' && notif.details) {
                    const req = notif.details;
                    const partName = req.newPartName || `request #${req.id}`;
                    message = `Your request for <strong>${partName}</strong> has been <strong>${req.status}</strong>.`;
                } else if (notif.type === 'part_request_new') {
                    // This is the new message for managers
                    message = `A <strong>new part request</strong> has been submitted.`;
                } else {
                    message = notif.message; // Fallback
                }

                // Add data attributes for the click handler
                return `
                    <div class="notification-item p-3 text-sm text-gray-600 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                         data-notification-id="${notif.id}"
                         data-notification-type="${notif.type}"
                         data-related-id="${notif.related_id}">
                        <p>${message}</p>
                        <p class="text-xs text-gray-400 mt-1">${new Date(notif.timestamp).toLocaleString()}</p>
                    </div>
                `;
            }).join('');
        } else {
            list.innerHTML = '<p class="p-4 text-sm text-gray-500">No new notifications.</p>';
        }
    } catch (error) {
        list.innerHTML = '<p class="p-4 text-sm text-red-500">Could not load notifications.</p>';
    }
}
/**
 * Renders the HTML for pagination controls.
 * @param {string} module The name of the module (e.g., 'assets').
 * @returns {string} The HTML string for the pagination controls.
 */
function renderPagination(module) {
  const paginationState = state.pagination[module];

  // The debug log confirmed this object is correct.
  if (!paginationState || paginationState.totalPages <= 1) {
    return '';
  }

  // --- START: MODIFICATION ---
  // We will now access properties directly from paginationState to avoid any potential errors.
  const currentPage = paginationState.currentPage;
  const totalPages = paginationState.totalPages;
  const totalRecords = paginationState.totalRecords;
  const limit = paginationState.limit || 20; // Use a default just in case

  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalRecords);
  const showingLabel = `Showing <span class="font-medium">${startItem}</span> to <span class="font-medium">${endItem}</span> of <span class="font-medium">${totalRecords}</span> results`;
  // --- END: MODIFICATION ---

  let pageLinks = '';
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
    const isCurrent = i === currentPage;
    pageLinks += `<button data-page="${i}" data-module="${module}" class="pagination-link ${isCurrent ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'} relative inline-flex items-center px-4 py-2 border text-sm font-medium"> ${i} </button>`;
  }

  const html = `
    <nav class="flex items-center justify-between mt-4">
      <div class="flex-1 flex justify-between sm:hidden">
        ${currentPage > 1 ? `<button data-page="${currentPage - 1}" data-module="${module}" class="pagination-link relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"> Previous </button>` : '<div></div>'}
        ${currentPage < totalPages ? `<button data-page="${currentPage + 1}" data-module="${module}" class="pagination-link relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"> Next </button>` : ''}
      </div>
      <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <p class="text-sm text-gray-700">
          ${showingLabel}
        </p>
        <div>
          <span class="relative z-0 inline-flex shadow-sm rounded-md">
            ${currentPage > 1 ? `<button data-page="${currentPage - 1}" data-module="${module}" class="pagination-link relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"> &laquo; </button>` : ''}
            ${pageLinks}
            ${currentPage < totalPages ? `<button data-page="${currentPage + 1}" data-module="${module}" class="pagination-link relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"> &raquo; </button>` : ''}
          </span>
        </div>
      </div>
    </nav>
  `;
  
  return html;
}

export function showFeedbackToAdminModal() {
    const form = document.getElementById('feedbackToAdminForm');
    form.reset();
    document.getElementById('feedbackToAdminModal').style.display = 'flex';
}