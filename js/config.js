// js/config.js

export const API_URL = 'http://localhost/mancis-cmms/backend';

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
  }
};