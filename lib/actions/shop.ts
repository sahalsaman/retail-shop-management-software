"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/mongoose";
import { Shop } from "@/models";
import { ShopProfileSchema, ShopTaxSchema, ShopPrinterSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateShopProfile(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return { ok: false, error: "Only owners can change shop profile" };
  }
  const parsed = ShopProfileSchema.safeParse({
    name: String(form.get("name") ?? ""),
    type: String(form.get("type") ?? ""),
    gstin: String(form.get("gstin") ?? ""),
    address: String(form.get("address") ?? ""),
    phone: String(form.get("phone") ?? ""),
    email: String(form.get("email") ?? ""),
    currency: String(form.get("currency") ?? "INR"),
    locale: String(form.get("locale") ?? "en-IN"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  await Shop.findByIdAndUpdate(user.shopId, { $set: parsed.data });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateShopTax(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return { ok: false, error: "Only owners can change tax settings" };
  }

  // checkbox: present in FormData only when checked
  const gstEnabled = form.get("gstEnabled") === "on" || form.get("gstEnabled") === "true";
  const parsed = ShopTaxSchema.safeParse({
    gstEnabled,
    gstin: String(form.get("gstin") ?? ""),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  await Shop.findByIdAndUpdate(user.shopId, {
    $set: { gstEnabled: parsed.data.gstEnabled, gstin: parsed.data.gstin },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

export async function updateShopPrinter(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return { ok: false, error: "Only owners can change printer settings" };
  }

  const parsed = ShopPrinterSchema.safeParse({
    printerEnabled: form.get("printerEnabled") === "on" || form.get("printerEnabled") === "true",
    printerPaperWidth: String(form.get("printerPaperWidth") ?? "80mm"),
    printerHeader: String(form.get("printerHeader") ?? ""),
    printerFooter: String(form.get("printerFooter") ?? ""),
    printerCopies: String(form.get("printerCopies") ?? "1"),
    printerAutoPrint: form.get("printerAutoPrint") === "on" || form.get("printerAutoPrint") === "true",
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  await Shop.findByIdAndUpdate(user.shopId, { $set: parsed.data });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/pos");
  return { ok: true };
}
