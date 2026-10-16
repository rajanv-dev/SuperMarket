import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.patch('/auth/change-password', data),
};

export const productService = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.patch(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  search: (q, params) => api.get('/products/search', { params: { q, ...params } }),
};

export const categoryService = {
  getAll: () => api.get('/categories'),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.patch(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const cartService = {
  get: () => api.get('/cart'),
  addItem: (data) => api.post('/cart/items', data),
  updateItem: (productId, data) => api.patch(`/cart/items/${productId}`, data),
  removeItem: (productId) => api.delete(`/cart/items/${productId}`),
  clear: () => api.delete('/cart'),
};

export const orderService = {
  create: (data) => api.post('/orders', data),
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  cancel: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }),
  reorder: (id) => api.post(`/orders/${id}/reorder`),
};

export const paymentService = {
  create: (data) => api.post('/payments/create', data),
  verify: (data) => api.post('/payments/verify', data),
};

export const inventoryService = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (productId) => api.get(`/inventory/${productId}`),
  adjust: (data) => api.post('/inventory/adjustments', data),
  getMovements: (params) => api.get('/inventory/movements', { params }),
};

export const couponService = {
  validate: (code, orderTotal) => api.post('/coupons/validate', { code, orderTotal }),
};

export const posService = {
  createSale: (data) => api.post('/pos/sales', data),
  getSale: (id) => api.get(`/pos/sales/${id}`),
  getSaleHistory: (params) => api.get('/pos/sales', { params }),
  voidSale: (id, reason) => api.post(`/pos/sales/${id}/void`, { reason }),
  getReceipt: (id) => api.get(`/pos/sales/${id}/receipt`),
};

export const analyticsService = {
  getOverview: (params) => api.get('/analytics/overview', { params }),
  getSalesTrend: (params) => api.get('/analytics/sales', { params }),
  getInventoryReport: () => api.get('/analytics/inventory'),
};

export const userService = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.patch('/users/me', data),
  addAddress: (data) => api.post('/users/me/addresses', data),
  updateAddress: (id, data) => api.patch(`/users/me/addresses/${id}`, data),
  deleteAddress: (id) => api.delete(`/users/me/addresses/${id}`),
  getWishlist: () => api.get('/users/me/wishlist'),
  toggleWishlist: (productId) => api.post(`/users/me/wishlist/${productId}`),
};
