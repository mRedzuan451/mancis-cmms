(function () {
  "use strict";

  console.log("script.js: File loaded and executing.");

  // =================================================================================
  //  PARTITION 1: CONFIGURATION & STATE
  // =================================================================================

  const API_URL = 'http://localhost/mancis-cmms/backend';

  const state = {
    currentUser: null,
    currentPage: "dashboard",
    sortKey: "id",
    sortOrder: "asc",
    calendarDate: new Date(),
    cache: {
      assets: [],
      parts: [],
      users: [],
      workOrders: [],
      partRequests: [],
      locations: {},
      logs: [],
      receivedParts: [],
    }
  };

  // =================================================================================
  //  PARTITION 1.5: API COMMUNICATION LAYER
  // =================================================================================
  
  const api = {
      async request(endpoint, options = {}) {
          try {
              const response = await fetch(`${API_URL}/${endpoint}`, options);
              if (!response.ok) {
                  const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
                  throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
              }
              const text = await response.text();
              return text ? JSON.parse(text) : {};
          } catch (error) {
              console.error(`API request failed for ${endpoint}:`, error);
              if (error instanceof SyntaxError && error.message.includes("Unexpected token")) {
                   showTemporaryMessage("A server error occurred. Please check the server logs.", true);
              } else {
                   showTemporaryMessage(error.message, true);
              }
              throw error;
          }
      },

      // GET operations
      getAssets: () => api.request('get_assets.php'),
      getParts: () => api.request('get_parts.php'),
      getUsers: () => api.request('get_users.php'),
      getWorkOrders: () => api.request('get_work_orders.php'),
      getPartRequests: () => api.request('get_part_requests.php'),
      getLocations: () => api.request('get_locations.php'),
      getLogs: () => api.request('get_logs.php'),
      getReceivedParts: () => api.request('get_received_parts.php'),
      
      // AUTH operations
      login: (username, password) => api.request('login.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
      }),
      createUser: (data) => api.request('create_user.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updateUserRole: (data) => api.request('update_user_role.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deleteUser: (id) => api.request(`delete_user.php?id=${id}`, { method: 'POST' }),

      // LOG operations
      createLog: (data) => api.request('create_log.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),

      // ASSET operations
      createAsset: (data) => api.request('create_asset.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updateAsset: (id, data) => api.request(`update_asset.php?id=${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deleteAsset: (id) => api.request(`delete_asset.php?id=${id}`, { method: 'POST' }),

      // PARTS operations
      createPart: (data) => api.request('create_part.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updatePart: (id, data) => api.request(`update_part.php?id=${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deletePart: (id) => api.request(`delete_part.php?id=${id}`, { method: 'POST' }),

      // WORK ORDER operations
      createWorkOrder: (data) => api.request('create_work_order.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updateWorkOrder: (id, data) => api.request(`update_work_order.php?id=${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deleteWorkOrder: (id) => api.request(`delete_work_order.php?id=${id}`, { method: 'POST' }),

      // LOCATION operations
      createLocation: (data) => api.request('create_location.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      deleteLocation: (data) => api.request('delete_location.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),

      // PART REQUEST WORKFLOW operations
      createPartRequest: (data) => api.request('create_part_request.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      updatePartRequestStatus: (data) => api.request('update_part_request_status.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      receiveParts: (data) => api.request('receive_parts.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
      restockParts: (data) => api.request('restock_parts.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      }),
  };


  // =================================================================================
  //  PARTITION 2: PERMISSIONS & AUTHENTICATION
  // =================================================================================

  const can = {
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

  // =================================================================================
  //  PARTITION 3: UTILITY & HELPER FUNCTIONS
  // =================================================================================

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

  function getNextDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  function getFullLocationName(locationId) {
    if (typeof locationId !== "string" || !locationId.includes("-"))
      return "N/A";

    const {
      divisions = [],
      departments = [],
      subLines = [],
      productionLines = [],
      cabinets = [],
      shelves = [],
      boxes = [],
    } = state.cache.locations || {};

    const [type, id] = locationId.split("-");
    const numId = parseInt(id);

    if (type === "pl") {
      const pLine = productionLines.find((l) => l.id === numId);
      if (!pLine) return "N/A";
      const subLine = subLines.find((sl) => sl.id === pLine.subLineId);
      if (!subLine) return pLine.name;
      const dept = departments.find((d) => d.id === subLine.departmentId);
      const div = dept
        ? divisions.find((d) => d.id === dept.divisionId)
        : null;
      return `${div ? div.name + " > " : ""}${
        dept ? dept.name + " > " : ""
      }${subLine.name} > ${pLine.name}`;
    } else if (type === "sl") {
      const subLine = subLines.find((sl) => sl.id === numId);
      if (!subLine) return "N/A";
      const dept = departments.find((d) => d.id === subLine.departmentId);
      const div = dept
        ? divisions.find((d) => d.id === dept.divisionId)
        : null;
      return `${div ? div.name + " > " : ""}${
        dept ? dept.name + " > " : ""
      }${subLine.name}`;
    } else if (type === "box") {
      const box = boxes.find((b) => b.id === numId);
      if (!box) return "N/A";
      const shelf = shelves.find((s) => s.id === box.shelfId);
      if (!shelf) return box.name;
      const cabinet = cabinets.find((c) => c.id === shelf.cabinetId);
      if (!cabinet) return `${shelf.name} > ${box.name}`;
      const dept = departments.find((d) => d.id === cabinet.departmentId);
      const div = dept
        ? divisions.find((d) => d.id === dept.divisionId)
        : null;
      return `${div ? div.name + " > " : ""}${
        dept ? dept.name + " > " : ""
      }${cabinet.name} > ${shelf.name} > ${box.name}`;
    } else if (type === "sh") {
      const shelf = shelves.find((s) => s.id === numId);
      if (!shelf) return "N/A";
      const cabinet = cabinets.find((c) => c.id === shelf.cabinetId);
      if (!cabinet) return shelf.name;
      const dept = departments.find((d) => d.id === cabinet.departmentId);
      const div = dept
        ? divisions.find((d) => d.id === dept.divisionId)
        : null;
      return `${div ? div.name + " > " : ""}${
        dept ? dept.name + " > " : ""
      }${cabinet.name} > ${shelf.name}`;
    } else if (type === "cab") {
      const cabinet = cabinets.find((c) => c.id === numId);
      if (!cabinet) return "N/A";
      const dept = departments.find((d) => d.id === cabinet.departmentId);
      const div = dept
        ? divisions.find((d) => d.id === dept.divisionId)
        : null;
      return `${div ? div.name + " > " : ""}${
        dept ? dept.name + " > " : ""
      }${cabinet.name}`;
    }
    return "N/A";
  }

  function getUserDepartment(user) {
    const { departments = [] } = state.cache.locations || {};
    const dept = departments.find((d) => d.id === user.departmentId);
    return dept ? dept.name : "N/A";
  }

  function showTemporaryMessage(message, isError = false) {
    const messageBox = document.createElement("div");
    messageBox.textContent = message;
    messageBox.style.position = "fixed";
    messageBox.style.bottom = "20px";
    messageBox.style.left = "50%";
    messageBox.style.transform = "translateX(-50%)";
    messageBox.style.padding = "10px 20px";
    messageBox.style.borderRadius = "8px";
    messageBox.style.color = "white";
    messageBox.style.backgroundColor = isError
      ? "rgba(239, 68, 68, 0.9)"
      : "rgba(34, 197, 94, 0.9)";
    messageBox.style.zIndex = "2000";
    messageBox.style.transition = "opacity 0.5s";

    document.body.appendChild(messageBox);

    setTimeout(() => {
      messageBox.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(messageBox)) {
          document.body.removeChild(messageBox);
        }
      }, 500);
    }, 3000);
  }

  function printReport(title, content) {
    const printWindow = window.open("", "_blank", "height=600,width=800");
    printWindow.document.write(
      "<html><head><title>" + title + "</title>"
    );
    printWindow.document.write(`
      <style>
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
          h2 { background-color: #f2f2f2; padding: 10px; margin-top: 20px; border-bottom: 1px solid #ddd; }
          p { margin-bottom: 20px; }
          @page { size: A4; margin: 20mm; }
          @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              h2 { background-color: #f2f2f2 !important; }
              tr { page-break-inside: avoid; }
          }
      </style>
  `);
    printWindow.document.write("</head><body>");
    printWindow.document.write(content);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function () {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  // =================================================================================
  //  PARTITION 4: UI RENDERING & MODALS
  // =================================================================================
  
  function renderDashboard() {
    const assets = state.cache.assets.filter(can.view);
    const workOrders = state.cache.workOrders.filter(can.view);
    const parts = state.cache.parts.filter(can.view);
    const partRequests = state.cache.partRequests.filter(can.view);
    
    const openWOs = workOrders.filter(
      (wo) => wo.status === "Open"
    ).length;
    const pendingRequests = partRequests.filter(
      (pr) => pr.status === "Requested"
    ).length;

    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const completedThisMonth = workOrders.filter((wo) => {
      if (wo.status !== "Completed") return false;
      const completedDate = new Date(wo.completedDate);
      return (
        completedDate.getMonth() === thisMonth &&
        completedDate.getFullYear() === thisYear
      );
    }).length;

    const lowStockItems = parts.filter(
      (p) => parseInt(p.quantity) <= parseInt(p.minQuantity)
    ).length;

    const highPriorityWOs = workOrders.filter(
      (wo) => wo.priority === "High" && wo.status === "Open"
    );

    return `
      <h1 class="text-3xl font-bold mb-6">Dashboard</h1>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div class="bg-white p-6 rounded-lg shadow">
              <h3 class="text-gray-500">Total Assets</h3>
              <p class="text-3xl font-bold">${assets.length}</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
              <h3 class="text-gray-500">Open Work Orders</h3>
              <p class="text-3xl font-bold">${openWOs}</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
              <h3 class="text-gray-500">Pending Part Requests</h3>
              <p class="text-3xl font-bold">${pendingRequests}</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
              <h3 class="text-gray-500">Low Stock Items</h3>
              <p class="text-3xl font-bold">${lowStockItems}</p>
          </div>
      </div>
      <h2 class="text-2xl font-bold mb-4">High Priority Work Orders</h2>
      <div class="bg-white p-4 rounded-lg shadow">
          ${
            highPriorityWOs.length > 0
              ? `
              <table class="w-full">
                  <thead>
                      <tr class="border-b">
                          <th class="text-left p-2">Title</th>
                          <th class="text-left p-2">Asset</th>
                          <th class="text-left p-2">Due Date</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${highPriorityWOs
                        .map(
                          (wo) => `
                          <tr class="border-b hover:bg-gray-50">
                              <td class="p-2">${wo.title}</td>
                              <td class="p-2">${
                                state.cache.assets.find((a) => a.id === parseInt(wo.assetId))
                                  ?.name || "N/A"
                              }</td>
                              <td class="p-2">${wo.dueDate}</td>
                          </tr>
                      `
                        )
                        .join("")}
                  </tbody>
              </table>
          `
              : `<p class="text-gray-500">No high priority work orders.</p>`
          }
      </div>
  `;
  }
  
  function renderAssetsPage() {
    const assets = state.cache.assets.filter(can.view);
    return `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">Asset Management</h1>
          <div>
              <button id="addAssetBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                  <i class="fas fa-plus mr-2"></i>Add Asset
              </button>
          </div>
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
                  <tbody id="assetTableBody">
                      ${generateTableRows("assets", assets)}
                  </tbody>
              </table>
          </div>
      </div>
  `;
  }

  function renderPartsPage() {
    const parts = state.cache.parts.filter(can.view);
    return `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">Spare Parts Management</h1>
          <div>
              <button id="addPartBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                  <i class="fas fa-plus mr-2"></i>Add Part
              </button>
          </div>
      </div>
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

  function renderWorkOrdersPage() {
    const workOrders = state.cache.workOrders.filter(can.view);
    return `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">Work Order Management</h1>
          <div>
              <button id="addWorkOrderBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                  <i class="fas fa-plus mr-2"></i>Create Work Order
              </button>
          </div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
          <input type="text" id="workOrderSearch" class="w-full mb-4 px-3 py-2 border rounded" placeholder="Search by title or asset name...">
          <div class="overflow-x-auto">
              <table class="w-full" id="workOrderTable">
                  <thead><tr class="border-b">
                      <th class="p-2 text-left cursor-pointer" data-sort="title">Title <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="assetId">Asset <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="dueDate">Due Date <i class="fas fa-sort"></i></th>
                      <th class="p-2 text-left cursor-pointer" data-sort="priority">Priority <i class="fas fa-sort"></i></th>
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

  function renderUserManagementPage() {
    const users = state.cache.users; // Admin can see all users
    return `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">User Management</h1>
      </div>
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

  function renderWorkOrderCalendar() {
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
              <h2 class="text-xl font-semibold">${calendarDate.toLocaleString(
                "default",
                { month: "long", year: "numeric" }
              )}</h2>
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
              <div class="text-center font-bold p-2 calendar-day-header">Sat</div>
  `;

    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarHtml += `<div class="calendar-day other-month"></div>`;
    }

    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const isToday = today.toDateString() === currentDate.toDateString();
      const dateStr = currentDate.toISOString().split("T")[0];

      const wosOnThisDay = workOrders.filter(
        (wo) => wo.dueDate === dateStr
      );
      const hasEvents = wosOnThisDay.length > 0;

      calendarHtml += `
          <div class="calendar-day p-2 ${isToday ? "today" : ""} ${
        hasEvents ? "cursor-pointer hover:bg-blue-100" : ""
      }" ${hasEvents ? `data-date="${dateStr}"` : ""}>
              <div class="font-bold">${day}</div>
              <div class="mt-1 space-y-1 overflow-y-auto max-h-20 pointer-events-none">
              ${wosOnThisDay
                .map((wo) => {
                  const priorityColor = {
                    High: "bg-red-100",
                    Medium: "bg-yellow-100",
                    Low: "bg-blue-100",
                  }[wo.priority];
                  let statusDotColor = "bg-gray-400"; // Default
                  if (wo.status === "Completed") {
                    statusDotColor = "bg-green-500";
                  } else if (wo.status === "Delay") {
                    statusDotColor = "bg-red-500";
                  } else if (
                    ["Open", "In Progress", "On Hold"].includes(wo.status)
                  ) {
                    statusDotColor = "bg-yellow-500"; // Pending
                  }
                  return `<div class="text-xs p-1 rounded ${priorityColor} flex items-center" title="${wo.title} - Status: ${wo.status}">
                              <span class="inline-block w-2 h-2 ${statusDotColor} rounded-full mr-1.5 flex-shrink-0"></span>
                              <span class="truncate">${wo.title}</span>
                          </div>`;
                })
                .join("")}
              </div>
          </div>
      `;
    }

    const lastDayOfMonth = new Date(year, month, daysInMonth).getDay();
    for (let i = lastDayOfMonth; i < 6; i++) {
      calendarHtml += `<div class="calendar-day other-month"></div>`;
    }

    calendarHtml += `</div></div>`;
    return calendarHtml;
  }

  function renderLocationsPage() {
    const {
      divisions = [],
      departments = [],
      subLines = [],
      productionLines = [],
      cabinets = [],
      shelves = [],
      boxes = [],
    } = state.cache.locations || {};
    const isAdmin = state.currentUser.role === "Admin";

    return `
      <h1 class="text-3xl font-bold mb-6">Location Management</h1>
      <div class="grid grid-cols-1 ${
        isAdmin ? "md:grid-cols-3" : ""
      } gap-6">
          
          ${
            isAdmin
              ? `
          <div class="bg-white p-4 rounded-lg shadow space-y-6">
              <div>
                  <h2 class="text-xl font-bold mb-4">Divisions</h2>
                  <ul id="divisionList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${
                        divisions
                          .map(
                            (d) => `
                          <li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <span>${d.name}</span>
                              <button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${d.id}" data-type="division"><i class="fas fa-trash"></i></button>
                          </li>`
                          )
                          .join("") ||
                        '<li class="text-gray-500">No divisions found.</li>'
                      }
                  </ul>
                  <form id="addDivisionForm" class="flex gap-2 border-t pt-4">
                      <input type="text" id="newDivisionName" class="flex-grow px-2 py-1 border rounded" placeholder="New Division Name" required>
                      <button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button>
                  </form>
              </div>

              <div>
                  <h2 class="text-xl font-bold mb-4">Departments</h2>
                  <ul id="departmentList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${
                        departments
                          .map((d) => {
                            const division = divisions.find(
                              (div) => div.id === d.divisionId
                            );
                            return `
                          <li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <div>
                                  <p>${d.name}</p>
                                  <p class="text-xs text-gray-500">${
                                    division
                                      ? division.name
                                      : "No Division"
                                  }</p>
                              </div>
                              <button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${
                                d.id
                              }" data-type="department"><i class="fas fa-trash"></i></button>
                          </li>`;
                          })
                          .join("") ||
                        '<li class="text-gray-500">No departments found.</li>'
                      }
                  </ul>
                  <form id="addDepartmentForm" class="border-t pt-4">
                      <select id="departmentDivisionSelect" class="w-full mb-2 px-2 py-1 border rounded" required>
                          <option value="">Select Division</option>
                          ${divisions
                            .map(
                              (d) =>
                                `<option value="${d.id}">${d.name}</option>`
                            )
                            .join("")}
                      </select>
                      <div class="flex gap-2">
                          <input type="text" id="newDepartmentName" class="flex-grow px-2 py-1 border rounded" placeholder="New Department Name" required>
                          <button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button>
                      </div>
                  </form>
              </div>

              <div>
                  <h2 class="text-xl font-bold mb-4">Sub Lines</h2>
                  <ul id="subLineList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${
                        subLines
                          .map((sl) => {
                            const department = departments.find(
                              (d) => d.id === sl.departmentId
                            );
                            return `
                          <li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <div>
                                  <p>${sl.name}</p>
                                  <p class="text-xs text-gray-500">${
                                    department
                                      ? department.name
                                      : "No Department"
                                  }</p>
                              </div>
                              <button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${
                                sl.id
                              }" data-type="subLine"><i class="fas fa-trash"></i></button>
                          </li>`;
                          })
                          .join("") ||
                        '<li class="text-gray-500">No sub lines found.</li>'
                      }
                  </ul>
                  <form id="addSubLineForm" class="border-t pt-4">
                      <select id="subLineDepartmentSelect" class="w-full mb-2 px-2 py-1 border rounded" required>
                          <option value="">Select Department</option>
                          ${departments
                            .map(
                              (d) =>
                                `<option value="${d.id}">${d.name}</option>`
                            )
                            .join("")}
                      </select>
                      <div class="flex gap-2">
                          <input type="text" id="newSubLineName" class="flex-grow px-2 py-1 border rounded" placeholder="New Sub Line Name" required>
                          <button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button>
                      </div>
                  </form>
              </div>

          </div>

          <div class="bg-white p-4 rounded-lg shadow">
              <h2 class="text-xl font-bold mb-4">Production Lines</h2>
              <ul id="productionLineList" class="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  ${
                    productionLines
                      .map((pl) => {
                        const subLine = subLines.find(
                          (sl) => sl.id === pl.subLineId
                        );
                        return `
                      <li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <div>
                              <p>${pl.name}</p>
                              <p class="text-xs text-gray-500">${
                                subLine ? subLine.name : "No Sub Line"
                              }</p>
                          </div>
                          <button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${
                            pl.id
                          }" data-type="productionLine"><i class="fas fa-trash"></i></button>
                      </li>`;
                      })
                      .join("") ||
                    '<li class="text-gray-500">No production lines found.</li>'
                  }
              </ul>
              <form id="addProductionLineForm" class="border-t pt-4">
                  <h3 class="font-semibold mb-2">Add New Production Line</h3>
                  <select id="productionLineSubLineSelect" class="w-full mb-2 px-2 py-1 border rounded" required>
                      <option value="">Select Sub Line</option>
                      ${subLines
                        .map(
                          (sl) =>
                            `<option value="${sl.id}">${sl.name}</option>`
                        )
                        .join("")}
                  </select>
                  <div class="flex gap-2">
                      <input type="text" id="newProductionLineName" class="flex-grow px-2 py-1 border rounded" placeholder="New Line Name" required>
                      <button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button>
                  </div>
              </form>
          </div>
          `
              : ""
          }

          <div class="bg-white p-4 rounded-lg shadow space-y-4">
              <h2 class="text-xl font-bold mb-2">Storage Locations</h2>
               <div>
                  <h3 class="font-semibold mb-2">Cabinets</h3>
                   <ul id="cabinetList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${
                        cabinets
                          .map((c) => {
                            const department = departments.find(
                              (d) => d.id === c.departmentId
                            );
                            return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <span>${
                                c.name
                              } <span class="text-xs text-gray-500">(${
                              department ? department.name : "N/A"
                            })</span></span>
                              <button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${
                                c.id
                              }" data-type="cabinet"><i class="fas fa-trash"></i></button>
                          </li>`;
                          })
                          .join("") ||
                        '<li class="text-gray-500">No cabinets found.</li>'
                      }
                  </ul>
                  <form id="addCabinetForm" class="border-t pt-2">
                      <select id="cabinetDepartmentSelect" class="w-full mb-2 px-2 py-1 border rounded" required>
                          <option value="">Select Department</option>
                          ${departments
                            .map(
                              (d) =>
                                `<option value="${d.id}">${d.name}</option>`
                            )
                            .join("")}
                      </select>
                      <div class="flex gap-2">
                          <input type="text" id="newCabinetName" class="flex-grow px-2 py-1 border rounded" placeholder="New Cabinet Name" required>
                          <button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button>
                      </div>
                  </form>
              </div>
               <div>
                  <h3 class="font-semibold mb-2">Shelves</h3>
                   <ul id="shelfList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${
                        shelves
                          .map((s) => {
                            const cabinet = cabinets.find(
                              (c) => c.id === s.cabinetId
                            );
                            return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <span>${
                                s.name
                              } <span class="text-xs text-gray-500">(${
                              cabinet ? cabinet.name : "N/A"
                            })</span></span>
                              <button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${
                                s.id
                              }" data-type="shelf"><i class="fas fa-trash"></i></button>
                          </li>`;
                          })
                          .join("") ||
                        '<li class="text-gray-500">No shelves found.</li>'
                      }
                  </ul>
                  <form id="addShelfForm" class="border-t pt-2">
                      <select id="shelfCabinetSelect" class="w-full mb-2 px-2 py-1 border rounded" required>
                          <option value="">Select Cabinet</option>
                          ${cabinets
                            .map(
                              (c) =>
                                `<option value="${c.id}">${c.name}</option>`
                            )
                            .join("")}
                      </select>
                      <div class="flex gap-2">
                          <input type="text" id="newShelfName" class="flex-grow px-2 py-1 border rounded" placeholder="New Shelf Name" required>
                          <button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button>
                      </div>
                  </form>
              </div>
               <div>
                  <h3 class="font-semibold mb-2">Boxes</h3>
                   <ul id="boxList" class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      ${
                        boxes
                          .map((b) => {
                            const shelf = shelves.find(
                              (s) => s.id === b.shelfId
                            );
                            return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <span>${
                                b.name
                              } <span class="text-xs text-gray-500">(${
                              shelf ? shelf.name : "N/A"
                            })</span></span>
                              <button class="delete-location-btn text-red-500 hover:text-red-700" data-id="${
                                b.id
                              }" data-type="box"><i class="fas fa-trash"></i></button>
                          </li>`;
                          })
                          .join("") ||
                        '<li class="text-gray-500">No boxes found.</li>'
                      }
                  </ul>
                  <form id="addBoxForm" class="border-t pt-2">
                      <select id="boxShelfSelect" class="w-full mb-2 px-2 py-1 border rounded" required>
                          <option value="">Select Shelf</option>
                          ${shelves
                            .map(
                              (s) =>
                                `<option value="${s.id}">${s.name}</option>`
                            )
                            .join("")}
                      </select>
                      <div class="flex gap-2">
                          <input type="text" id="newBoxName" class="flex-grow px-2 py-1 border rounded" placeholder="New Box Name" required>
                          <button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded">+</button>
                      </div>
                  </form>
              </div>
          </div>
      </div>
  `;
  }

  function renderActivityLogPage() {
    const logs = state.cache.logs;
    return `
      <h1 class="text-3xl font-bold mb-6">Activity Log</h1>
      <div class="bg-white p-4 rounded-lg shadow">
          <ul class="space-y-4">
              ${logs
                .map(
                  (log) => `
                  <li class="border-b pb-2">
                      <p class="font-semibold">${
                        log.action
                      } <span class="font-normal text-gray-600">by ${
                    log.user
                  }</span></p>
                      <p class="text-sm text-gray-500">${new Date(
                        log.timestamp
                      ).toLocaleString()}</p>
                      ${
                        log.details
                          ? `<p class="text-sm mt-1 text-gray-700">${log.details}</p>`
                          : ""
                      }
                  </li>
              `
                )
                .join("")}
          </ul>
      </div>
  `;
  }

  function renderPartsRequestPage() {
    const partRequests = state.cache.partRequests.filter(can.view);
    return `
      <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold">Part Requests</h1>
          <div class="space-x-2">
               <button id="printPurchaseListBtn" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded">
                  <i class="fas fa-file-invoice mr-2"></i>Print Purchase List
              </button>
               <button id="storageRequestBtn" class="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded">
                  <i class="fas fa-warehouse mr-2"></i>Request from Storage
              </button>
              <button id="newPartRequestBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                  <i class="fas fa-plus mr-2"></i>New Purchase Request
              </button>
              <button id="receivePartsBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
                  <i class="fas fa-box-open mr-2"></i>Receive Parts
              </button>
              <button id="restockPartsBtn" class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded">
                  <i class="fas fa-dolly-flatbed mr-2"></i>Restock Parts
              </button>
          </div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
          <div class="overflow-x-auto">
              <table class="w-full">
                  <thead><tr class="border-b">
                      <th class="p-2 text-left">Part Name</th>
                      <th class="p-2 text-left">Part Number</th>
                      <th class="p-2 text-left">Maker</th>
                      <th class="p-2 text-left">Quantity</th>
                      <th class="p-2 text-left">Purpose</th>
                      <th class="p-2 text-left">Status</th>
                      <th class="p-2 text-left">Actions</th>
                  </tr></thead>
                  <tbody>
                      ${generateTableRows("partRequests", partRequests)}
                  </tbody>
              </table>
          </div>
      </div>
  `;
  }


  function generateTableRows(type, data) {
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
        valA =
          state.cache.assets.find((asset) => asset.id === parseInt(a.assetId))
            ?.name || "";
        valB =
          state.cache.assets.find((asset) => asset.id === parseInt(b.assetId))
            ?.name || "";
      }

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return state.sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return state.sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    
    switch (type) {
      case "assets":
        return data
          .map(
            (asset) => `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${asset.name}</td>
                  <td class="p-2">${asset.tag}</td>
                  <td class="p-2">${getFullLocationName(
                    asset.locationId
                  )}</td>
                  <td class="p-2">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                      asset.status === "Active"
                        ? "bg-green-200 text-green-800"
                        : asset.status === "Decommissioned"
                        ? "bg-gray-200 text-gray-800"
                        : "bg-yellow-200 text-yellow-800"
                    }">
                      ${asset.status}
                    </span>
                  </td>
                  <td class="p-2 space-x-2">
                      <button class="view-asset-btn text-blue-500 hover:text-blue-700" data-id="${
                        asset.id
                      }" title="View Details"><i class="fas fa-eye"></i></button>
                      <button class="edit-asset-btn text-yellow-500 hover:text-yellow-700" data-id="${
                        asset.id
                      }" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="transfer-asset-btn text-purple-500 hover:text-purple-700" data-id="${
                        asset.id
                      }" title="Transfer"><i class="fas fa-truck"></i></button>
                      <button class="delete-asset-btn text-red-500 hover:text-red-700" data-id="${
                        asset.id
                      }" title="Delete"><i class="fas fa-trash"></i></button>
                      ${
                        asset.status !== "Decommissioned"
                          ? `<button class="dispose-asset-btn text-gray-500 hover:text-gray-700" data-id="${asset.id}" title="Dispose"><i class="fas fa-ban"></i></button>`
                          : ""
                      }
                  </td>
              </tr>`
          )
          .join("");
      case "parts":
        return data
          .map(
            (part) => `
              <tr class="border-b hover:bg-gray-50 ${
                parseInt(part.quantity) <= parseInt(part.minQuantity) ? "bg-red-100" : ""
              }">
                  <td class="p-2">${part.name}</td>
                  <td class="p-2">${part.sku}</td>
                  <td class="p-2">${part.category || "N/A"}</td>
                  <td class="p-2">${part.supplier || "N/A"}</td>
                  <td class="p-2">${part.quantity} ${
              parseInt(part.quantity) <= parseInt(part.minQuantity)
                ? '<span class="text-red-600 font-bold">(Low)</span>'
                : ""
            }</td>
                  <td class="p-2">${
                    part.price
                      ? `${part.currency || ""} ${parseFloat(part.price).toFixed(2)}`
                      : "N/A"
                  }</td>
                  <td class="p-2 space-x-2">
                      <button class="view-part-btn text-blue-500 hover:text-blue-700" data-id="${
                        part.id
                      }" title="View Details"><i class="fas fa-eye"></i></button>
                      <button class="edit-part-btn text-yellow-500 hover:text-yellow-700" data-id="${
                        part.id
                      }" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="delete-part-btn text-red-500 hover:text-red-700" data-id="${
                        part.id
                      }"><i class="fas fa-trash"></i></button>
                  </td>
              </tr>`
          )
          .join("");
      case "workOrders":
        const woStatusColors = {
          Open: "bg-blue-200 text-blue-800",
          "In Progress": "bg-yellow-200 text-yellow-800",
          "On Hold": "bg-orange-200 text-orange-800",
          Delay: "bg-red-200 text-red-800",
          Completed: "bg-green-200 text-green-800",
        };
        return data
          .map((wo) => {
            const assetName =
              state.cache.assets.find((a) => a.id === parseInt(wo.assetId))?.name ||
              "N/A";
            const priorityColor = {
              High: "text-red-600",
              Medium: "text-yellow-600",
              Low: "text-blue-600",
            }[wo.priority];
            const statusColorClass =
              woStatusColors[wo.status] || "bg-gray-200 text-gray-800";
            return `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${wo.title}</td>
                  <td class="p-2">${assetName}</td>
                  <td class="p-2">${wo.dueDate}</td>
                  <td class="p-2 font-bold ${priorityColor}">${
              wo.priority
            }</td>
                  <td class="p-2">
                     <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}">
                      ${wo.status}
                     </span>
                  </td>
                  <td class="p-2 space-x-2">
                      <button class="view-wo-btn text-blue-500 hover:text-blue-700" data-id="${
                        wo.id
                      }" title="View Details"><i class="fas fa-eye"></i></button>
                      ${
                        wo.status !== "Completed"
                          ? `<button class="complete-wo-btn text-green-500 hover:text-green-700" data-id="${wo.id}" title="Complete"><i class="fas fa-check-circle"></i></button>`
                          : ""
                      }
                      <button class="edit-wo-btn text-yellow-500 hover:text-yellow-700" data-id="${
                        wo.id
                      }" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="delete-wo-btn text-red-500 hover:text-red-700" data-id="${
                        wo.id
                      }" title="Delete"><i class="fas fa-trash"></i></button>
                  </td>
              </tr>`;
          })
          .join("");
      case "users":
        return data
          .map((user) => {
              const department = getUserDepartment(user);
              return `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${user.fullName}</td>
                  <td class="p-2">${user.username}</td>
                  <td class="p-2">${user.role}</td>
                  <td class="p-2">${department}</td>
                  <td class="p-2 space-x-2">
                      ${
                          user.id !== 1
                          ? `<button class="edit-user-btn text-yellow-500 hover:text-yellow-700" data-id="${user.id}" title="Edit Role"><i class="fas fa-user-shield"></i></button>`
                          : ''
                      }
                      ${
                          // Prevent deleting the current user or the primary admin (ID 1)
                          user.id !== state.currentUser.id && user.id !== 1
                          ? `<button class="delete-user-btn text-red-500 hover:text-red-700" data-id="${user.id}" title="Delete User"><i class="fas fa-trash"></i></button>`
                          : ""
                      }
                  </td>
              </tr>
          `;
          })
          .join("");
      case "partRequests":
        const prStatusColors = {
          Requested: "bg-blue-200 text-blue-800",
          "Requested from Storage": "bg-cyan-200 text-cyan-800",
          Approved: "bg-yellow-200 text-yellow-800",
          Rejected: "bg-red-200 text-red-800",
          Received: "bg-green-200 text-green-800",
          Completed: "bg-gray-400 text-gray-800",
        };
        return data
          .map((req) => {
            const part = req.partId
              ? state.cache.parts.find((p) => p.id === req.partId)
              : null;
            const partName = part
              ? part.name
              : `<span class="italic text-gray-500">${req.newPartName} (New)</span>`;
            const partNumber =
              req.newPartNumber || (part ? part.sku : "N/A");
            const maker = req.newPartMaker || (part ? part.maker : "N/A");
            const user = state.cache.users.find((u) => u.id === req.requesterId);
            const statusColorClass =
              prStatusColors[req.status] || "bg-gray-200 text-gray-800";
            return `
              <tr class="border-b hover:bg-gray-50">
                  <td class="p-2">${partName}</td>
                  <td class="p-2">${partNumber}</td>
                  <td class="p-2">${maker}</td>
                  <td class="p-2">${req.quantity}</td>
                  <td class="p-2">${req.purpose}</td>
                  <td class="p-2">
                      <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}">
                          ${req.status}
                      </span>
                  </td>
                  <td class="p-2 space-x-2">
                      ${
                        (state.currentUser.role === "Admin" ||
                          state.currentUser.role === "Manager") &&
                        (req.status === "Requested" ||
                          req.status === "Requested from Storage")
                          ? `
                          <button class="approve-pr-btn text-green-500 hover:text-green-700" data-id="${req.id}" title="Approve"><i class="fas fa-check"></i></button>
                          <button class="reject-pr-btn text-red-500 hover:text-red-700" data-id="${req.id}" title="Reject"><i class="fas fa-times"></i></button>
                      `
                          : ""
                      }
                  </td>
              </tr>
          `;
          })
          .join("");
      default:
          return '';
    }
  }

  // =================================================================================
  //  PARTITION 5: MAIN RENDERER & NAVIGATION
  // =================================================================================

  async function render() {
    if (!state.currentUser) {
      document.getElementById("loginScreen").style.display = "flex";
      document.getElementById("app").style.display = "none";
    } else {
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("app").style.display = "block";
      renderSidebar();
      await renderMainContent();
    }
  }

  function renderSidebar() {
      const { fullName, role } = state.currentUser;
      document.getElementById("userFullName").textContent = fullName;
      document.getElementById("userRole").textContent = role;
      document.getElementById("userDepartment").textContent =
          getUserDepartment(state.currentUser);

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
          .map(
          (link) => `
              <a href="#" class="nav-link flex items-center p-2 rounded-lg hover:bg-gray-700 ${
              state.currentPage === link.page ? "bg-gray-900" : ""
              }" data-page="${link.page}">
                  <i class="fas ${link.icon} w-6 text-center"></i>
                  <span class="ml-3">${link.text}</span>
              </a>
          `
          )
          .join("");
  }

  async function renderMainContent() {
    const mainContent = document.getElementById("mainContent");
    let content = "";

    if (!can.viewPage(state.currentPage)) {
      state.currentPage = "dashboard";
    }

    switch (state.currentPage) {
      case "dashboard":
        content = renderDashboard();
        break;
      case "assets":
        content = renderAssetsPage();
        break;
      case "parts":
        content = renderPartsPage();
        break;
      case "workOrders":
        content = renderWorkOrdersPage();
        break;
      case "userManagement":
        content = renderUserManagementPage();
        break;
      case "workOrderCalendar":
        content = renderWorkOrderCalendar();
        break;
      case "locations":
        content = renderLocationsPage();
        break;
      case "activityLog":
        content = renderActivityLogPage();
        break;
      case "partRequests":
        content = renderPartsRequestPage();
        break;
      default:
        content = renderDashboard();
    }
    mainContent.innerHTML = content;
    
    attachPageSpecificEventListeners(state.currentPage);

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle(
        "bg-gray-900",
        link.dataset.page === state.currentPage
      );
    });
  }

  // =================================================================================
  //  PARTITION 6: EVENT HANDLERS & ACTION LOGIC
  // =================================================================================

  async function loadInitialData() {
      try {
          const [assets, parts, users, workOrders, partRequests, locations, logs, receivedParts] = await Promise.all([
              api.getAssets(),
              api.getParts(),
              api.getUsers(),
              api.getWorkOrders(),
              api.getPartRequests(),
              api.getLocations(),
              api.getLogs(),
              api.getReceivedParts(),
          ]);

          state.cache.assets = assets;
          state.cache.parts = parts;
          state.cache.users = users;
          state.cache.workOrders = workOrders;
          state.cache.partRequests = partRequests;
          state.cache.locations = locations;
          state.cache.logs = logs;
          state.cache.receivedParts = receivedParts;

      } catch (error) {
          showTemporaryMessage("Failed to load initial application data. Please try again.", true);
          handleLogout();
      }
  }

  async function handleLogin(e) {
    e.preventDefault();
    console.log("handleLogin triggered"); // DEBUG
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    try {
      const user = await api.login(username, password);
      if (user && user.id) {
          state.currentUser = user;
          document.getElementById("loginError").textContent = "";
          document.getElementById("loginForm").reset();
          
          await loadInitialData();
          await logActivity("User Login");
          await render();
      } else {
          document.getElementById("loginError").textContent = "Invalid username or password.";
      }
    } catch (error) {
      document.getElementById("loginError").textContent = "Login failed. Please try again.";
    }
  }
  
  async function handleLogout() {
    await logActivity("User Logout");
    state.currentUser = null;
    state.currentPage = "dashboard";
    Object.keys(state.cache).forEach(key => {
        state.cache[key] = Array.isArray(state.cache[key]) ? [] : {};
    });
    await render();
  }

  async function handleRegistration(e) {
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
          role: "Clerk", // New users default to Clerk role
      };

      try {
          await api.createUser(userData);
          await logActivity("User Registered", `New user created: ${userData.fullName}`);
          
          document.getElementById("registrationModal").style.display = "none";
          document.getElementById("registrationForm").reset();
          showTemporaryMessage("Account created successfully! You can now log in.");
          
          if (state.currentUser && state.currentUser.role === 'Admin') {
              state.cache.users = await api.getUsers();
              await renderMainContent();
          }

      } catch (error) {
          regError.textContent = error.message;
      }
  }

  async function deleteUser(userId) {
      if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
          try {
              const userToDelete = state.cache.users.find(u => u.id === userId);
              await api.deleteUser(userId);
              await logActivity("User Deleted", `Deleted user: ${userToDelete.fullName} (${userToDelete.username})`);

              state.cache.users = await api.getUsers();
              await renderMainContent();
              showTemporaryMessage('User deleted successfully.');
          } catch (error) {
              showTemporaryMessage(error.message, true);
          }
      }
  }

  async function handleUserRoleFormSubmit(e) {
      e.preventDefault();
      const userId = parseInt(document.getElementById("editUserId").value);
      const role = document.getElementById("editUserRole").value;

      try {
          await api.updateUserRole({ userId, role });
          await logActivity("User Role Changed", `Changed role for user ID ${userId} to ${role}`);
          
          state.cache.users = await api.getUsers();
          document.getElementById("editUserModal").style.display = "none";
          await renderMainContent();
          showTemporaryMessage("User role updated successfully!");
      } catch (error) {
          showTemporaryMessage(error.message, true);
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
      await renderMainContent();
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
          await renderMainContent();
          showTemporaryMessage('Asset deleted successfully.');
      } catch (error) {
          showTemporaryMessage('Failed to delete asset.', true);
      }
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
      await renderMainContent();
      showTemporaryMessage('Part saved successfully!');

    } catch(error) {
      showTemporaryMessage('Failed to save part.', true);
    }
  }

  async function deletePart(partId) {
    if (confirm("Are you sure you want to delete this spare part?")) {
      try {
          const partToDelete = state.cache.parts.find(p => p.id === partId);
          await api.deletePart(partId);
          await logActivity("Part Deleted", `Deleted part: ${partToDelete.name} (ID: ${partId})`);
          
          state.cache.parts = await api.getParts();
          await renderMainContent();
          showTemporaryMessage('Part deleted successfully.');
      } catch (error) {
          showTemporaryMessage('Failed to delete part.', true);
      }
    }
  }

  async function handleWorkOrderFormSubmit(e) {
    e.preventDefault();
    const woIdValue = document.getElementById("workOrderId").value;
    const isEditing = !!woIdValue;

    const checklist = [];
    document.querySelectorAll("#woChecklistContainer .checklist-item span").forEach((item) => {
        checklist.push({ text: item.textContent, completed: false });
    });

    const requiredParts = [];
    document.querySelectorAll(".wo-part-row").forEach((row) => {
        const partId = row.querySelector(".wo-part-select").value;
        const quantity = parseInt(row.querySelector(".wo-part-qty").value);
        if (partId && quantity > 0) {
            requiredParts.push({ partId: parseInt(partId), quantity });
        }
    });

    const woData = {
      title: document.getElementById("woTitle").value,
      description: document.getElementById("woDescription").value,
      assetId: parseInt(document.getElementById("woAsset").value),
      assignedTo: parseInt(document.getElementById("woAssignedTo").value),
      task: document.getElementById("woTask").value,
      dueDate: document.getElementById("woDueDate").value,
      priority: document.getElementById("woPriority").value,
      frequency: document.getElementById("woFrequency").value,
      status: document.getElementById("woStatus").value,
      breakdownTimestamp: document.getElementById("woBreakdownTime").value || null,
      checklist: checklist,
      requiredParts: requiredParts,
    };

    try {
      if (isEditing) {
          const woId = parseInt(woIdValue);
          const existingWo = state.cache.workOrders.find(w => w.id === woId);
          woData.completionNotes = existingWo.completionNotes || null;
          woData.completedDate = existingWo.completedDate || null;
          await api.updateWorkOrder(woId, woData);
          await logActivity("Work Order Updated", `Updated WO: ${woData.title} (ID: ${woId})`);
      } else {
          await api.createWorkOrder(woData);
          await logActivity("Work Order Created", `Created WO: ${woData.title}`);
      }

      state.cache.workOrders = await api.getWorkOrders();
      document.getElementById("workOrderModal").style.display = "none";
      await renderMainContent();
      showTemporaryMessage('Work Order saved successfully!');

    } catch (error) {
      showTemporaryMessage('Failed to save Work Order.', true);
    }
  }

  async function deleteWorkOrder(woId) {
      if (confirm("Are you sure you want to delete this work order?")) {
          try {
              const woToDelete = state.cache.workOrders.find(w => w.id === woId);
              await api.deleteWorkOrder(woId);
              await logActivity("Work Order Deleted", `Deleted WO: ${woToDelete.title} (ID: ${woId})`);
              
              state.cache.workOrders = await api.getWorkOrders();
              await renderMainContent();
              showTemporaryMessage('Work Order deleted successfully.');
          } catch (error) {
              showTemporaryMessage('Failed to delete Work Order.', true);
          }
      }
  }

  async function handleLocationFormSubmit(e, type) {
      e.preventDefault();
      const form = e.target;
      const name = form.querySelector('input[type="text"]').value;
      const parentSelect = form.querySelector('select');
      const parentId = parentSelect ? parseInt(parentSelect.value) : null;
      
      const locationData = { type, name, parentId };

      try {
          await api.createLocation(locationData);
          await logActivity("Location Added", `Added ${type}: ${name}`);
          state.cache.locations = await api.getLocations();
          await renderMainContent();
          showTemporaryMessage('Location added successfully.');
      } catch (error) {
          showTemporaryMessage('Failed to add location.', true);
      }
  }

  async function deleteLocation(type, id) {
      if (confirm(`Are you sure you want to delete this ${type}? This may affect items assigned to it.`)) {
          try {
              await api.deleteLocation({ type, id });
              await logActivity("Location Deleted", `Deleted ${type} with ID: ${id}`);
              state.cache.locations = await api.getLocations();
              await renderMainContent();
              showTemporaryMessage('Location deleted successfully.');
          } catch (error) {
              showTemporaryMessage(error.message, true);
          }
      }
  }

  async function handlePartRequestFormSubmit(e) {
      e.preventDefault();
      const isNewPart = document.getElementById("requestNewPartCheckbox").checked;
      const newRequest = {
          quantity: parseInt(document.getElementById("requestQuantity").value),
          purpose: document.getElementById("requestPurpose").value,
          requesterId: state.currentUser.id,
          requestDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
          status: "Requested",
          partId: isNewPart ? null : parseInt(document.getElementById("requestPartId").value),
          newPartName: isNewPart ? document.getElementById("newPartName").value : null,
          newPartNumber: isNewPart ? document.getElementById("newPartNumber").value : null,
          newPartMaker: isNewPart ? document.getElementById("newPartMaker").value : null,
      };

      try {
          await api.createPartRequest(newRequest);
          await logActivity("Part Request Submitted", `Requested ${newRequest.quantity} of ${isNewPart ? newRequest.newPartName : `part ID ${newRequest.partId}`}`);
          state.cache.partRequests = await api.getPartRequests();
          document.getElementById("partRequestModal").style.display = "none";
          await renderMainContent();
          showTemporaryMessage('Part request submitted.');
      } catch (error) {
          showTemporaryMessage('Failed to submit part request.', true);
      }
  }

  async function handlePartRequestAction(requestId, newStatus) {
      const request = state.cache.partRequests.find(pr => pr.id === requestId);
      if (!request) return;

      const payload = {
          id: requestId,
          status: newStatus,
          approverId: state.currentUser.id,
          originalStatus: request.status
      };

      try {
          await api.updatePartRequestStatus(payload);
          await logActivity(`Part Request ${newStatus}`, `Request ID: ${requestId}`);
          state.cache.partRequests = await api.getPartRequests();
          if (payload.originalStatus === 'Requested from Storage') {
              state.cache.parts = await api.getParts();
          }
          await renderMainContent();
          showTemporaryMessage(`Request #${requestId} has been ${newStatus.toLowerCase()}.`);
      } catch (error) {
          showTemporaryMessage(`Failed to update request status: ${error.message}`, true);
      }
  }

  async function handleReceivePartsFormSubmit(e) {
      e.preventDefault();
      const requestId = parseInt(document.getElementById("receiveRequestId").value);
      try {
          await api.receiveParts({ requestId, receiverId: state.currentUser.id });
          await logActivity("Parts Received", `Marked parts for request #${requestId} as received.`);
          state.cache.partRequests = await api.getPartRequests();
          state.cache.receivedParts = await api.getReceivedParts();
          document.getElementById("receivePartsModal").style.display = "none";
          await renderMainContent();
          showTemporaryMessage('Parts marked as received.');
      } catch (error) {
          showTemporaryMessage(`Failed to receive parts: ${error.message}`, true);
      }
  }

  async function handleRestockPartsFormSubmit(e) {
      e.preventDefault();
      const receivedPartId = parseInt(document.getElementById("restockPartId").value);
      const locationId = document.getElementById("restockLocationId").value;
      try {
          await api.restockParts({ receivedPartId, locationId });
          await logActivity("Parts Restocked", `Restocked parts from received ID #${receivedPartId}`);
          state.cache.parts = await api.getParts();
          state.cache.partRequests = await api.getPartRequests();
          state.cache.receivedParts = await api.getReceivedParts();
          document.getElementById("restockPartsModal").style.display = "none";
          await renderMainContent();
          showTemporaryMessage('Parts restocked successfully.');
      } catch (error) {
          showTemporaryMessage(`Failed to restock parts: ${error.message}`, true);
      }
  }

  // =================================================================================
  //  PARTITION 7: INITIALIZATION & EVENT LISTENERS
  // =================================================================================

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
    console.log("script.js: DOMContentLoaded event fired.");
    attachGlobalEventListeners();
    render();
  });
})();
