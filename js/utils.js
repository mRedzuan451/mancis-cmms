// js/utils.js

import { state } from './config.js';
import { api } from './api.js';

/**
 * Logs an activity to the database.
 * @param {string} action The action performed.
 * @param {string} details Additional details about the action.
 */
export async function logActivity(action, details = "") {
    try {
        // Ensure currentUser is available before logging
        if (state.currentUser) {
            await api.createLog({
                user: state.currentUser.fullName,
                action,
                details
            });
        }
    } catch (error) {
        console.error("Failed to write log to database:", error);
    }
}

/**
 * Gets a future date formatted as YYYY-MM-DD.
 * @param {number} days The number of days to add to the current date.
 * @returns {string} The formatted date string.
 */
export function getNextDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Constructs a full, human-readable location name from a location ID.
 * @param {string} locationId The location ID (e.g., 'pl-1', 'box-5').
 * @returns {string} The full location path.
 */
// js/utils.js

export function getFullLocationName(locationId) {
  if (typeof locationId !== "string" || !locationId.includes("-")) return "N/A";

  const {
    divisions = [], departments = [], subLines = [], productionLines = [],
    cabinets = [], shelves = [], boxes = [],
  } = state.cache.locations || {};

  const [type, id] = locationId.split("-");
  const numId = parseInt(id);

  switch (type) {
    case "pl": {
      const pLine = productionLines.find((l) => l.id === numId);
      if (!pLine) return "N/A";
      const subLine = subLines.find((sl) => sl.id === pLine.subLineId);
      if (!subLine) return pLine.name;
      const dept = departments.find((d) => d.id === subLine.departmentId);
      const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
      return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${subLine.name} > ${pLine.name}`;
    }
    case "sl": {
      const subLine = subLines.find((sl) => sl.id === numId);
      if (!subLine) return "N/A";
      const dept = departments.find((d) => d.id === subLine.departmentId);
      const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
      return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${subLine.name}`;
    }
    case "box": {
      const box = boxes.find((b) => b.id === numId);
      if (!box) return "N/A";
      const shelf = shelves.find((s) => s.id === box.shelfId);
      if (!shelf) return box.name;
      const cabinet = cabinets.find((c) => c.id === shelf.cabinetId);
      if (!cabinet) return `${shelf.name} > ${box.name}`;
      const dept = departments.find((d) => d.id === cabinet.departmentId);
      const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
      return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${cabinet.name} > ${shelf.name} > ${box.name}`;
    }
    case "sh": {
      const shelf = shelves.find((s) => s.id === numId);
      if (!shelf) return "N/A";
      const cabinet = cabinets.find((c) => c.id === shelf.cabinetId);
      if (!cabinet) return shelf.name;
      const dept = departments.find((d) => d.id === cabinet.departmentId);
      const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
      return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${cabinet.name} > ${shelf.name}`;
    }
    case "cab": {
      const cabinet = cabinets.find((c) => c.id === numId);
      if (!cabinet) return "N/A";
      const dept = departments.find((d) => d.id === cabinet.departmentId);
      const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
      return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${cabinet.name}`;
    }
    // --- START: ADDED LOGIC ---
    case "dept": {
      const dept = departments.find((d) => d.id === numId);
      if (!dept) return "N/A";
      const div = divisions.find((d) => d.id === dept.divisionId);
      return `${div ? div.name + " > " : ""}${dept.name}`;
    }
    case "div": {
      const div = divisions.find((d) => d.id === numId);
      return div ? div.name : "N/A";
    }
    // --- END: ADDED LOGIC ---
    default:
      return "N/A";
  }
}

/**
 * Gets the department name for a given user.
 * @param {Object} user The user object.
 * @returns {string} The department name or 'N/A'.
 */
export function getUserDepartment(user) {
  const { departments = [] } = state.cache.locations || {};
  const dept = departments.find((d) => d.id === user.departmentId);
  return dept ? dept.name : "N/A";
}

/**
 * Displays a temporary message (toast) at the bottom of the screen.
 * @param {string} message The message to display.
 * @param {boolean} isError If true, the message will be styled as an error.
 */
export function showTemporaryMessage(message, isError = false) {
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

/**
 * Opens the browser's print dialog for a given HTML content.
 * @param {string} title The title of the report.
 * @param {string} content The HTML content to be printed.
 */
export function printReport(title, content) {
    const printWindow = window.open("", "_blank", "height=600,width=800");

    // Add a check for pop-up blockers
    if (!printWindow) {
        alert("Please allow pop-ups for this site to print reports.");
        return;
    }

    const today = new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    // --- START: MODIFICATION ---
    // New, enhanced CSS for a formal A4 layout with header and footer.
    const formalStyle = `
        <style>
            body { 
                font-family: Arial, sans-serif; 
                font-size: 11pt;
                margin: 0;
            }
            .print-container {
                display: table;
                width: 100%;
                height: 100%;
                border-collapse: collapse;
            }
            .report-header {
                display: table-header-group;
                padding: 20mm 20mm 10mm 20mm;
                border-bottom: 2px solid #000;
            }
            .report-footer {
                display: table-footer-group;
                padding: 10mm 20mm;
                border-top: 1px solid #ccc;
                font-size: 9pt;
                color: #555;
            }
            .report-content {
                display: table-row-group;
            }
            .header-content, .footer-content {
                padding: 0 20mm; /* Match page margins */
            }
            .header-flex {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
            }
            .logo-container img {
                height: 25px;
            }
            .header-text {
                text-align: right;
            }
            .header-text h1 {
                margin: 0;
                font-size: 18pt;
            }
            .header-text p {
                margin: 0;
                font-size: 10pt;
            }
            .footer-content {
                display: flex;
                justify-content: space-between;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 10px;
            }
            th, td { 
                border: 1px solid #ccc; 
                padding: 6px 8px; 
                text-align: left; 
            }
            th {
                background-color: #f2f2f2;
            }
            h2 { 
                background-color: #f2f2f2 !important; 
                padding: 10px; 
                margin-top: 20px; 
                border-bottom: 1px solid #ddd;
            }

            @page { 
                size: A4; 
                margin: 20mm; 
            }
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .report-header, .report-footer {
                    display: table-header-group; /* Ensures they repeat on each page */
                }
            }
        </style>
    `;
    
    // New document structure using the reliable table layout
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                ${formalStyle}
            </head>
            <body>
                <div class="print-container">
                    <header class="report-header">
                        <div class="header-content">
                            <div class="header-flex">
                                <div class="logo-container">
                                    <img src="mancis.png" alt="Company Logo">
                                </div>
                                <p>ManCIS</p>
                                <div class="header-text">
                                    <h1>${title}</h1>
                                    <p>Date Generated: ${today}</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    <footer class="report-footer">
                        <div class="footer-content">
                            <span>Page 1</span> 
                        </div>
                    </footer>

                    <main class="report-content">
                        <div style="padding: 0 20mm;">
                            ${content}
                        </div>
                    </main>
                </div>
            </body>
        </html>
    `);
    // --- END: MODIFICATION ---

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        try {
            printWindow.print();
            printWindow.close();
        } catch (error) {
            console.error("Could not print the report:", error);
        }
    }, 500);
}

/**
 * Calculates the next due date for a PM Schedule.
 * @param {object} schedule The PM schedule object.
 * @returns {string} The formatted next due date (YYYY-MM-DD).
 */
// js/utils.js

export function calculateNextPmDate(schedule) {
  if (!schedule) return 'N/A';

  const baseDateStr = schedule.last_generated_date || schedule.schedule_start_date;
  if (!baseDateStr || baseDateStr === 'N/A') return 'N/A';

  const baseDate = new Date(baseDateStr + 'T00:00:00');
  const interval = schedule.frequency_interval || 1;
  // Ensure unit has a fallback and correct singular/plural form for the function
  const unit = (schedule.frequency_unit || 'Week').replace('(s)', ''); 

  // Add the interval based on the unit
  switch (unit) {
    case 'Day':   baseDate.setDate(baseDate.getDate() + interval); break;
    case 'Week':  baseDate.setDate(baseDate.getDate() + (interval * 7)); break;
    case 'Month': baseDate.setMonth(baseDate.getMonth() + interval); break;
    case 'Year':  baseDate.setFullYear(baseDate.getFullYear() + interval); break;
    default: return 'N/A';
  }

  // Final check to ensure the calculated date is valid
  if (isNaN(baseDate.getTime())) {
      return 'N/A';
  }

  return baseDate.toISOString().split('T')[0];
}