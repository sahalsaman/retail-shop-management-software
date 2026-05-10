"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Expense } from "@/models";
import { ExpenseSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function readForm(form: FormData) {
  return {
    category: String(form.get("category") ?? "OTHER"),
    amount: String(form.get("amount") ?? "0"),
    paymentMethod: String(form.get("paymentMethod") ?? "CASH"),
    branchId: String(form.get("branchId") ?? ""),
    date: String(form.get("date") ?? ""),
    note: String(form.get("note") ?? ""),
  };
}

export async function createExpense(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  const parsed = ExpenseSchema.safeParse(readForm(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  const doc = await Expense.create({
    shopId: user.shopId,
    ...parsed.data,
    createdBy: user.id,
  });
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
  return { ok: true, id: String(doc._id) };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  await Expense.deleteOne({ _id: id, shopId: user.shopId });
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}
