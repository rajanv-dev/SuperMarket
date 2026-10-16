// Central place for all application-wide constants
module.exports = {
  // ── Roles ──────────────────────────────────────────────────────────────────
  ROLES: {
    CUSTOMER: 'customer',
    CASHIER: 'cashier',
    INVENTORY_MANAGER: 'inventoryManager',
    ADMIN: 'admin',
  },

  // ── Order states ───────────────────────────────────────────────────────────
  ORDER_STATUS: {
    PENDING_PAYMENT: 'PENDING_PAYMENT',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    READY_FOR_DELIVERY: 'READY_FOR_DELIVERY',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
  },

  // Valid transitions: { fromStatus: [allowedToStatuses] }
  ORDER_TRANSITIONS: {
    PENDING_PAYMENT: ['CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['READY_FOR_DELIVERY', 'CANCELLED'],
    READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED'],
    DELIVERED: ['REFUNDED'],
    PAYMENT_FAILED: ['PENDING_PAYMENT', 'CANCELLED'],
    CANCELLED: [],
    REFUNDED: [],
  },

  // ── Payment states ─────────────────────────────────────────────────────────
  PAYMENT_STATUS: {
    CREATED: 'CREATED',
    PENDING: 'PENDING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  },

  // ── POS / Sale states ──────────────────────────────────────────────────────
  SALE_STATUS: {
    OPEN: 'OPEN',
    COMPLETED: 'COMPLETED',
    VOIDED: 'VOIDED',
    REFUNDED: 'REFUNDED',
  },

  // ── Inventory movement types ───────────────────────────────────────────────
  STOCK_MOVEMENT_TYPES: {
    STOCK_IN: 'STOCK_IN',
    STOCK_OUT: 'STOCK_OUT',
    SALE_DEDUCTION: 'SALE_DEDUCTION',
    ONLINE_ORDER_DEDUCTION: 'ONLINE_ORDER_DEDUCTION',
    RETURN: 'RETURN',
    ADJUSTMENT: 'ADJUSTMENT',
    TRANSFER_IN: 'TRANSFER_IN',
    TRANSFER_OUT: 'TRANSFER_OUT',
    EXPIRED_WRITE_OFF: 'EXPIRED_WRITE_OFF',
    RESERVATION_HOLD: 'RESERVATION_HOLD',
    RESERVATION_RELEASE: 'RESERVATION_RELEASE',
  },

  // ── Reservation states ─────────────────────────────────────────────────────
  RESERVATION_STATUS: {
    ACTIVE: 'ACTIVE',
    CONFIRMED: 'CONFIRMED',
    RELEASED: 'RELEASED',
    EXPIRED: 'EXPIRED',
  },

  // ── Price unit ─────────────────────────────────────────────────────────────
  // All money is stored as integer paise (1 INR = 100 paise)
  CURRENCY_UNIT: 'paise',

  // ── Reservation TTL ────────────────────────────────────────────────────────
  RESERVATION_TTL_MINUTES: 15,

  // ── Pagination defaults ────────────────────────────────────────────────────
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};
