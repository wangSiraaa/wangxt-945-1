import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.error || '请求失败';
    return Promise.reject(new Error(msg));
  }
);

export const departmentApi = {
  list: () => api.get('/departments'),
};

export const employeeApi = {
  list: (deptId) => api.get('/employees', { params: { department_id: deptId } }),
};

export const menuApi = {
  list: () => api.get('/menus'),
  dailyList: (params) => api.get('/daily-menus', { params }),
};

export const canteenApi = {
  list: () => api.get('/canteens'),
};

export const orderApi = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  verify: (id, data) => api.post(`/orders/${id}/verify`, data),
  substitute: (id, data) => api.post(`/orders/${id}/substitute`, data),
};

export const approvalApi = {
  list: (params) => api.get('/approvals', { params }),
  approve: (id, data) => api.post(`/approvals/${id}/approve`, data),
  reject: (id, data) => api.post(`/approvals/${id}/reject`, data),
};

export const prepApi = {
  list: (date, mealType) => api.get('/prep-list', { params: { date, meal_type: mealType } }),
};

export const budgetApi = {
  list: (params) => api.get('/department-budgets', { params }),
  freezeRecords: (params) => api.get('/budget-freeze-records', { params }),
};

export const settlementApi = {
  list: (params) => api.get('/settlements', { params }),
  get: (id) => api.get(`/settlements/${id}`),
  generate: (data) => api.post('/settlements/generate', data),
  confirm: (id) => api.post(`/settlements/${id}/confirm`),
  recalculate: (id) => api.post(`/settlements/${id}/recalculate`),
};

export const inventoryApi = {
  transactions: (params) => api.get('/inventory-transactions', { params }),
};

export const wasteApi = {
  list: (params) => api.get('/waste-records', { params }),
  create: (data) => api.post('/waste-records', data),
};

export const supplementApi = {
  create: (data) => api.post('/supplement-orders', data),
};

export const reconciliationApi = {
  diff: (params) => api.get('/reconciliation-diff', { params }),
};

export const verificationApi = {
  list: (params) => api.get('/verification-records', { params }),
};

export const settingsApi = {
  list: () => api.get('/settings'),
  update: (key, value) => api.put(`/settings/${key}`, { value }),
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
};
