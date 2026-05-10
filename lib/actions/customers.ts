"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Customer, Payment } from "@/models";
import { CustomerSchema, PaymentRecordSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<string, never> : { data: T }))
  | { ok: false; error: string };

function readForm(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    email: String(form.get("email") ?? ""),
    address: String(form.get("address") ?? ""),
    gstin: String(form.get("gstin") ?? ""),
    isActive: form.get("isActive") !== "off" && form.get("isActive") !== "false",
  };
}

export async function createCustomer(form: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  const parsed = CustomerSchema.safeParse(readForm(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  try {
    const doc = await Customer.create({ shopId: user.shopId, ...parsed.data });
    revalidatePath("/dashboard/customers");
    return { ok: true, data: { id: String(doc._id) } };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: number }).code === 11000) {
      return { ok: false, error: "Phone already in use" };
    }
    console.error(e);
    return { ok: false, error: "Failed to create customer" };
  }
}

export async function updateCustomer(id: string, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  const parsed = CustomerSchema.safeParse(readForm(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  await Customer.findOneAndUpdate(
    { _id: id, shopId: user.shopId },
    { $set: parsed.data },
    { returnDocument: "after" },
  );
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  return { ok: true } as ActionResult;
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  await Customer.deleteOne({ _id: id, shopId: user.shopId });
  revalidatePath("/dashboard/customers");
  return { ok: true } as ActionResult;
}

export async function recordCustomerPayment(
  customerId: string,
  form: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(customerId)) return { ok: false, error: "Invalid customer" };

  const parsed = PaymentRecordSchema.safeParse({
    amount: String(form.get("amount") ?? "0"),
    method: String(form.get("method") ?? "CASH"),
    date: String(form.get("date") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  const customer = await Customer.findOne({ _id: customerId, shopId: user.shopId });
  if (!customer) return { ok: false, error: "Customer not found" };

  await Payment.create({
    shopId: user.shopId,
    type: "CUSTOMER_DUE",
    customerId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    date: parsed.data.date,
    note: parsed.data.note,
    createdBy: user.id,
  });

  await Customer.updateOne(
    { _id: customerId, shopId: user.shopId },
    { $inc: { creditBalance: -parsed.data.amount } },
  );

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  return { ok: true } as ActionResult;
}
