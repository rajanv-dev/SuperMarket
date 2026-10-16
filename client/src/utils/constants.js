// Mirror of server-side constants.js for the frontend
export const ROLES = {
  CUSTOMER: 'customer',
  CASHIER: 'cashier',
  INVENTORY_MANAGER: 'inventoryManager',
  ADMIN: 'admin',
};

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  READY_FOR_DELIVERY: 'READY_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
};

export const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: 'Pending Payment',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  READY_FOR_DELIVERY: 'Ready for Delivery',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PAYMENT_FAILED: 'Payment Failed',
};

export const ORDER_STATUS_COLOR = {
  PENDING_PAYMENT: 'amber',
  CONFIRMED: 'blue',
  PROCESSING: 'blue',
  READY_FOR_DELIVERY: 'blue',
  OUT_FOR_DELIVERY: 'blue',
  DELIVERED: 'green',
  CANCELLED: 'red',
  REFUNDED: 'slate',
  PAYMENT_FAILED: 'red',
};

// All amounts are in paise — use this to display in rupees
export const paiseToRupees = (paise) => (paise / 100).toFixed(2);
export const rupeesToPaise = (rupees) => Math.round(parseFloat(rupees) * 100);

export const formatCurrency = (paise) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);

export const formatDate = (dateStr) =>
  new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
