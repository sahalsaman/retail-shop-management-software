export const ROLES = ["ADMIN", "OWNER", "MANAGER", "CASHIER", "SALES_EXECUTIVE"] as const;
export type Role = (typeof ROLES)[number];

export const SHOP_TYPES = [
  "GROCERY",
  "ELECTRONICS",
  "FASHION",
  "STATIONERY",
  "HARDWARE",
  "MOBILE",
  "OTHER",
] as const;
export type ShopType = (typeof SHOP_TYPES)[number];

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "CREDIT"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_STATUS = ["COMPLETED", "HELD", "RETURNED", "VOID"] as const;
export type SaleStatus = (typeof SALE_STATUS)[number];

export const STOCK_MOVEMENT_TYPES = [
  "PURCHASE",
  "SALE",
  "RETURN_IN",
  "RETURN_OUT",
  "ADJUSTMENT",
  "DAMAGE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "OPENING",
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
