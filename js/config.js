// js/config.js

export const API_URL = 'http://192.168.190.42/mancis-cmms/backend';

export const state = {
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
    pmSchedules: [],
    stockTakes: [],
    feedback: [],
  },
  charts: {},
  sidebarSections: {
    management: true, // Let's have the main section open by default
    admin: false,
  },
};