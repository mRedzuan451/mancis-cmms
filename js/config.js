// js/config.js

export const API_URL = 'http://10.228.149.42/mancis-cmms/backend';

export const state = {
  currentUser: null,
  currentPage: "dashboard",
  sortKey: "id",
  sortOrder: "asc",
  calendarDate: new Date(),
  pagination: {
    assets: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 },
    parts: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 },
    workOrders: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 },
    partRequests: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 },
    users: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 },
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
    management: true,
    admin: false,
  },
  showArchivedFeedback: false,
};