import { z } from "zod";
import { ROLES, SHOP_TYPES, STOCK_MOVEMENT_TYPES } from "./types";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdRegex, "Invalid id");
const optionalObjectId = z
  .string()
  .trim()
  .refine((v) => v === "" || objectIdRegex.test(v), "Invalid id")
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const SignupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  shopName: z.string().trim().min(2, "Shop name is required"),
  shopType: z.enum(SHOP_TYPES),
  branchName: z.string().trim().min(2, "Branch name is required").default("Main Branch"),
});

// Login accepts either an email or a username — the `email` column on User
// is used as the canonical identifier either way (admins use short usernames,
// shop owners use email).
export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter your username or email"),
  password: z.string().min(1, "Password required"),
});

export const CreateInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  ownerName: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  shopName: z.string().trim().min(2, "Shop name is required"),
  shopType: z.enum(SHOP_TYPES),
});

export const AcceptInviteSchema = z.object({
  token: z.string().min(10, "Invalid invite token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  branchName: z.string().trim().min(2).default("Main Branch"),
});

export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

/* -------------------- Phase 2: Catalog & Inventory -------------------- */

export const CategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  parent: optionalObjectId.optional(),
});

export const BrandSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});

export const ProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, dot, dash, underscore only")
    .transform((s) => s.toUpperCase()),
  barcode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  categoryId: optionalObjectId.optional(),
  brandId: optionalObjectId.optional(),
  hsnCode: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((v) => (v ? v : null)),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  purchasePrice: z.coerce.number().min(0, "Cannot be negative"),
  sellingPrice: z.coerce.number().min(0, "Cannot be negative"),
  mrp: z
    .union([z.coerce.number().min(0), z.literal("").transform(() => null)])
    .optional()
    .nullable(),
  unit: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .default("PCS")
    .transform((s) => s.toUpperCase()),
  images: z.array(z.string().trim().url("Must be a valid URL")).default([]),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  hasExpiry: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const StockAdjustmentSchema = z.object({
  productId: objectId,
  branchId: objectId,
  delta: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, "Quantity change cannot be zero"),
  type: z.enum(STOCK_MOVEMENT_TYPES).default("ADJUSTMENT"),
  note: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  batchNo: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  expiryDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !isNaN(d.getTime()), "Invalid expiry date"),
});

export type CategoryInput = z.infer<typeof CategorySchema>;
export type BrandInput = z.infer<typeof BrandSchema>;
export type ProductInput = z.infer<typeof ProductSchema>;
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;

/* -------------------- Phase 4: Customers, Suppliers, Purchases -------------------- */

const indianPhone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const CustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: indianPhone,
  email: z
    .union([z.string().trim().email("Invalid email"), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  address: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  gstin: z
    .string()
    .trim()
    .max(15)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  isActive: z.coerce.boolean().default(true),
});

export const SupplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  email: z
    .union([z.string().trim().email("Invalid email"), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  address: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  gstin: z
    .string()
    .trim()
    .max(15)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  openingBalance: z.coerce.number().default(0),
  isActive: z.coerce.boolean().default(true),
});

export const PaymentRecordSchema = z.object({
  amount: z.coerce.number().positive("Amount must be > 0"),
  method: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
  date: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date())),
  note: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const PurchaseItemSchema = z.object({
  productId: objectId,
  name: z.string().trim().min(1),
  sku: z.string().trim().nullable().optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().default("PCS"),
  unitCost: z.coerce.number().min(0),
  gstRate: z.coerce.number().min(0).default(0),
  batchNo: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  expiryDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});

export const PurchaseCreateSchema = z.object({
  branchId: objectId,
  supplierId: objectId,
  invoiceNumber: z.string().trim().min(1).max(40),
  intraState: z.coerce.boolean().default(true),
  paidAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
  notes: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  items: z.array(PurchaseItemSchema).min(1, "Add at least one item"),
});

export const ExpenseSchema = z.object({
  category: z.enum([
    "RENT",
    "SALARY",
    "ELECTRICITY",
    "INTERNET",
    "TRANSPORT",
    "MAINTENANCE",
    "MARKETING",
    "STATIONERY",
    "FOOD",
    "OTHER",
  ]),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
  branchId: optionalObjectId.optional(),
  date: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date())),
  note: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;
export type SupplierInput = z.infer<typeof SupplierSchema>;
export type PaymentRecordInput = z.infer<typeof PaymentRecordSchema>;
export type PurchaseCreateInput = z.infer<typeof PurchaseCreateSchema>;
export type ExpenseInput = z.infer<typeof ExpenseSchema>;

/* -------------------- Settings + Employees -------------------- */

export const ShopProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(SHOP_TYPES),
  gstin: z
    .string()
    .trim()
    .max(15)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  address: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  email: z
    .union([z.string().trim().email("Invalid email"), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  currency: z.string().trim().max(8).default("INR"),
  locale: z.string().trim().max(10).default("en-IN"),
});

export const ShopTaxSchema = z.object({
  gstEnabled: z.coerce.boolean().default(true),
  gstin: z
    .string()
    .trim()
    .max(15)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
});

export const ShopPrinterSchema = z.object({
  printerEnabled: z.coerce.boolean().default(false),
  printerPaperWidth: z.enum(["58mm", "80mm"]).default("80mm"),
  printerHeader: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  printerFooter: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  printerCopies: z.coerce.number().int().min(1).max(3).default(1),
  printerAutoPrint: z.coerce.boolean().default(true),
});

export type ShopPrinterInput = z.infer<typeof ShopPrinterSchema>;

export const EmployeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  email: z
    .union([z.string().trim().email("Invalid email"), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  designation: z.enum([
    "OWNER",
    "MANAGER",
    "CASHIER",
    "SALES",
    "STOCKROOM",
    "DELIVERY",
    "CLEANER",
    "OTHER",
  ]),
  monthlySalary: z.coerce.number().min(0).default(0),
  branchId: optionalObjectId.optional(),
  joinedAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date())),
  notes: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  canLogin: z.coerce.boolean().default(false),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .max(40)
    .regex(/^[a-z0-9._-]*$/, "Username can use letters, numbers, dot, dash, underscore")
    .optional()
    .transform((v) => (v ? v : null)),
  password: z
    .string()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  loginRole: z.enum(ROLES).default("CASHIER").refine((r) => r !== "ADMIN" && r !== "OWNER", {
    message: "Employee role cannot be admin or owner",
  }),
  pageAccess: z.array(z.string()).default([]),
  isActive: z.coerce.boolean().default(true),
}).refine((d) => !d.canLogin || !!d.username, {
  message: "Username is required when app access is enabled",
  path: ["username"],
});

export const SalaryPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be > 0"),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
  date: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date())),
  period: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  branchId: optionalObjectId.optional(),
});

export type ShopProfileInput = z.infer<typeof ShopProfileSchema>;
export type ShopTaxInput = z.infer<typeof ShopTaxSchema>;
export type EmployeeInput = z.infer<typeof EmployeeSchema>;
export type SalaryPaymentInput = z.infer<typeof SalaryPaymentSchema>;

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  phone: z
    .union([
      z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
      z.literal("").transform(() => null),
    ])
    .nullable()
    .optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
