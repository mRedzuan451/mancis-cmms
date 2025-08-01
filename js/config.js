// js/config.js

export const API_URL = 'http://192.168.79.42/mancis-cmms/backend';

export const state = {
  currentUser: null,
  currentPage: "dashboard",
  sortKey: "id",
  sortOrder: "asc",
  calendarDate: new Date(),
  pagination: {
    assets: { currentPage: 1, totalPages: 1, totalRecords: 0 },
    parts: { currentPage: 1, totalPages: 1, totalRecords: 0 },
    workOrders: { currentPage: 1, totalPages: 1, totalRecords: 0 },
    users: { currentPage: 1, totalPages: 1, totalRecords: 0 },
    // Add other modules here as you implement pagination for them
  },
  cache: {
    assets: [],
    parts: [],
    users: [],
    workOrders: [],
    partRequests: [],
    locations: {},
    logs: [],
    receivedParts: [],
    pmSchedules: [],
    stockTakes: [],
    feedback: [],
  },
  charts: {},
  sidebarSections: {
    management: true, // Let's have the main section open by default
    admin: false,
  },
  showArchivedFeedback: false,
};