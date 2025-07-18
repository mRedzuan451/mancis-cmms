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
export function getFullLocationName(locationId) {
  if (typeof locationId !== "string" || !locationId.includes("-")) return "N/A";

  const {
    divisions = [], departments = [], subLines = [], productionLines = [],
    cabinets = [], shelves = [], boxes = [],
  } = state.cache.locations || {};

  const [type, id] = locationId.split("-");
  const numId = parseInt(id);

  if (type === "pl") {
    const pLine = productionLines.find((l) => l.id === numId);
    if (!pLine) return "N/A";
    const subLine = subLines.find((sl) => sl.id === pLine.subLineId);
    if (!subLine) return pLine.name;
    const dept = departments.find((d) => d.id === subLine.departmentId);
    const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
    return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${subLine.name} > ${pLine.name}`;
  } else if (type === "sl") {
    const subLine = subLines.find((sl) => sl.id === numId);
    if (!subLine) return "N/A";
    const dept = departments.find((d) => d.id === subLine.departmentId);
    const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
    return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${subLine.name}`;
  } else if (type === "box") {
    const box = boxes.find((b) => b.id === numId);
    if (!box) return "N/A";
    const shelf = shelves.find((s) => s.id === box.shelfId);
    if (!shelf) return box.name;
    const cabinet = cabinets.find((c) => c.id === shelf.cabinetId);
    if (!cabinet) return `${shelf.name} > ${box.name}`;
    const dept = departments.find((d) => d.id === cabinet.departmentId);
    const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
    return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${cabinet.name} > ${shelf.name} > ${box.name}`;
  } else if (type === "sh") {
    const shelf = shelves.find((s) => s.id === numId);
    if (!shelf) return "N/A";
    const cabinet = cabinets.find((c) => c.id === shelf.cabinetId);
    if (!cabinet) return shelf.name;
    const dept = departments.find((d) => d.id === cabinet.departmentId);
    const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
    return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${cabinet.name} > ${shelf.name}`;
  } else if (type === "cab") {
    const cabinet = cabinets.find((c) => c.id === numId);
    if (!cabinet) return "N/A";
    const dept = departments.find((d) => d.id === cabinet.departmentId);
    const div = dept ? divisions.find((d) => d.id === dept.divisionId) : null;
    return `${div ? div.name + " > " : ""}${dept ? dept.name + " > " : ""}${cabinet.name}`;
  }
  return "N/A";
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

    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    p { margin-bottom: 20px; }
                    @page { size: A4; margin: 20mm; }
                    @media print {
                        .no-print { display: none; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                    .print-button-container { text-align: right; padding: 10px; }
                    .print-button { padding: 8px 16px; border: 1px solid #ccc; background-color: #f0f0f0; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="no-print print-button-container">
                    <button id="printPageBtn" class="print-button">Print this page</button>
                </div>
                ${content}
            </body>
        </html>
    `);

    printWindow.document.close();
    
    // Use a timeout to ensure the popup DOM is ready before we access it
    setTimeout(() => {
        try {
            const printButton = printWindow.document.getElementById('printPageBtn');
            if (printButton) {
                printButton.addEventListener('click', function() {
                    printWindow.print();
                });
            }
        } catch (error) {
            // This will catch any errors if the window was closed before the script ran
            console.error("Could not attach print event listener:", error);
        }
    }, 250); // A 250ms delay

    printWindow.focus();
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