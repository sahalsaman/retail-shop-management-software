import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Shop } from "@/models";

export type PrinterSettings = {
  enabled: boolean;
  paperWidth: "58mm" | "80mm";
  header: string | null;
  footer: string | null;
  copies: number;
  autoPrint: boolean;
};

export type ShopSettings = {
  id: string;
  name: string;
  type: string;
  gstin: string | null;
  gstEnabled: boolean;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  locale: string;
  isActive: boolean;
  printer: PrinterSettings;
};

export async function getShopSettings(shopIdStr: string): Promise<ShopSettings | null> {
  try {
    await connectDB();
    if (!Types.ObjectId.isValid(shopIdStr)) return null;
    const doc = await Shop.findById(shopIdStr).lean<{
      _id: Types.ObjectId;
      name: string;
      type: string;
      gstin: string | null;
      gstEnabled: boolean | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      currency: string;
      locale: string;
      isActive: boolean;
      printerEnabled: boolean | null;
      printerPaperWidth: "58mm" | "80mm" | null;
      printerHeader: string | null;
      printerFooter: string | null;
      printerCopies: number | null;
      printerAutoPrint: boolean | null;
    } | null>();
    if (!doc) return null;
    return {
      id: String(doc._id),
      name: doc.name,
      type: doc.type,
      gstin: doc.gstin,
      gstEnabled: doc.gstEnabled !== false, // default-true: undefined → enabled
      address: doc.address,
      phone: doc.phone,
      email: doc.email,
      currency: doc.currency,
      locale: doc.locale,
      isActive: doc.isActive,
      printer: {
        enabled: !!doc.printerEnabled,
        paperWidth: (doc.printerPaperWidth ?? "80mm") as "58mm" | "80mm",
        header: doc.printerHeader ?? null,
        footer: doc.printerFooter ?? null,
        copies: doc.printerCopies ?? 1,
        autoPrint: doc.printerAutoPrint !== false,
      },
    };
  } catch {
    return null;
  }
}

export async function getPrinterSettings(
  shopIdStr: string,
): Promise<PrinterSettings> {
  await connectDB();
  if (!Types.ObjectId.isValid(shopIdStr))
    return defaultPrinter();
  const doc = await Shop.findById(shopIdStr)
    .select(
      "printerEnabled printerPaperWidth printerHeader printerFooter printerCopies printerAutoPrint",
    )
    .lean<{
      printerEnabled: boolean | null;
      printerPaperWidth: "58mm" | "80mm" | null;
      printerHeader: string | null;
      printerFooter: string | null;
      printerCopies: number | null;
      printerAutoPrint: boolean | null;
    } | null>();
  if (!doc) return defaultPrinter();
  return {
    enabled: !!doc.printerEnabled,
    paperWidth: (doc.printerPaperWidth ?? "80mm") as "58mm" | "80mm",
    header: doc.printerHeader ?? null,
    footer: doc.printerFooter ?? null,
    copies: doc.printerCopies ?? 1,
    autoPrint: doc.printerAutoPrint !== false,
  };
}

function defaultPrinter(): PrinterSettings {
  return {
    enabled: false,
    paperWidth: "80mm",
    header: null,
    footer: null,
    copies: 1,
    autoPrint: true,
  };
}

/**
 * Lightweight read for layout/page components that only need the GST flag —
 * used to decide whether to render tax UI without pulling the whole shop doc.
 */
export async function isGstEnabled(shopIdStr: string): Promise<boolean> {
  await connectDB();
  if (!Types.ObjectId.isValid(shopIdStr)) return true;
  const doc = await Shop.findById(shopIdStr)
    .select("gstEnabled")
    .lean<{ gstEnabled: boolean | null } | null>();
  return doc?.gstEnabled !== false;
}
