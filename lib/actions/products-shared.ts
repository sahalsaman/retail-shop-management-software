import "server-only";
import { z } from "zod";

// Shared, non-action helpers for the product write layer. Kept out of the
// "use server" files so they can be imported by both the SQLite (desktop) and
// cloud Mongo (web) implementations — a "use server" module may only export
// async server actions.

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type QuickAddProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  gstRate: number;
  sellingPrice: number;
  mrp: number | null;
  stock: number;
};

export type QuickAddResult =
  | { ok: true; product: QuickAddProduct }
  | { ok: false; error: string };

export const QuickAddSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  sku: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9._-]*$/, "Letters, numbers, dot, dash, underscore only")
    .optional()
    .transform((s) => (s ? s.toUpperCase() : "")),
  unit: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .default("PCS")
    .transform((s) => s.toUpperCase()),
  sellingPrice: z.coerce.number().min(0, "Cannot be negative"),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  openingStock: z.coerce.number().int().min(0).default(0),
  branchId: z.string().min(1, "Invalid branch"),
});

export type QuickAddInput = {
  name: string;
  sku?: string;
  unit?: string;
  sellingPrice: number | string;
  gstRate?: number | string;
  openingStock?: number | string;
  branchId: string;
};

export function readForm(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    sku: String(form.get("sku") ?? ""),
    barcode: String(form.get("barcode") ?? ""),
    categoryId: String(form.get("categoryId") ?? ""),
    brandId: String(form.get("brandId") ?? ""),
    hsnCode: String(form.get("hsnCode") ?? ""),
    gstRate: String(form.get("gstRate") ?? "0"),
    purchasePrice: String(form.get("purchasePrice") ?? "0"),
    sellingPrice: String(form.get("sellingPrice") ?? "0"),
    mrp: String(form.get("mrp") ?? ""),
    unit: String(form.get("unit") ?? "PCS"),
    images: String(form.get("images") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    lowStockThreshold: String(form.get("lowStockThreshold") ?? "5"),
    hasExpiry: form.get("hasExpiry") === "on" || form.get("hasExpiry") === "true",
    isActive: form.get("isActive") !== "off" && form.get("isActive") !== "false",
    description: String(form.get("description") ?? ""),
  };
}
