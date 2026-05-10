"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Supplier, Payment } from "@/models";
import { SupplierSchema, PaymentRecordSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function readForm(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    email: String(form.get("email") ?? ""),
    address: String(form.get("address") ?? ""),
    gstin: String(form.get("gstin") ?? ""),
    openingBalance: String(form.get("openingBalance") ?? "0"),
    isActive: form.get("isActive") !== "off" && form.get("isActive") !== "false",
  };
}

export async function createSupplier(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  const parsed = SupplierSchema.safeParse(readForm(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  const doc = await Supplier.create({
    shopId: user.shopId,
    ...parsed.data,
    currentBalance: parsed.data.openingBalance,
  });
  revalidatePath("/dashboard/suppliers");
  return { ok: true, id: String(doc._id) };
}

export async function updateSupplier(id: string, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  const parsed = SupplierSchema.safeParse(readForm(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  // currentBalance is managed by purchases/payments — only update opening if changed
  const { openingBalance, ...rest } = parsed.data;
  void openingBalance;
  await Supplier.findOneAndUpdate(
    { _id: id, shopId: user.shopId },
    { $set: rest },
    { returnDocument: "after" },
  );
  revalidatePath("/dashboard/suppliers");
  revalidatePath(`/dashboard/suppliers/${id}`);
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  await Supplier.deleteOne({ _id: id, shopId: user.shopId });
  revalidatePath("/dashboard/suppliers");
  return { ok: true };
}

export async function recordSupplierPayment(
  supplierId: string,
  form: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(supplierId)) return { ok: false, error: "Invalid supplier" };

  const parsed = PaymentRecordSchema.safeParse({
    amount: String(form.get("amount") ?? "0"),
    method: String(form.get("method") ?? "CASH"),
    date: String(form.get("date") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  const sup = await Supplier.findOne({ _id: supplierId, shopId: user.shopId });
  if (!sup) return { ok: false, error: "Supplier not found" };

  await Payment.create({
    shopId: user.shopId,
    type: "SUPPLIER_DUE",
    supplierId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    date: parsed.data.date,
    note: parsed.data.note,
    createdBy: user.id,
  });

  await Supplier.updateOne(
    { _id: supplierId, shopId: user.shopId },
    { $inc: { currentBalance: -parsed.data.amount } },
  );

  revalidatePath(`/dashboard/suppliers/${supplierId}`);
  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard");
  return { ok: true };
}
