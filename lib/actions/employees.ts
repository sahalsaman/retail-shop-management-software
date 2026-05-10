"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Employee, Expense } from "@/models";
import { EmployeeSchema, SalaryPaymentSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function readForm(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    email: String(form.get("email") ?? ""),
    designation: String(form.get("designation") ?? "OTHER"),
    monthlySalary: String(form.get("monthlySalary") ?? "0"),
    branchId: String(form.get("branchId") ?? ""),
    joinedAt: String(form.get("joinedAt") ?? ""),
    notes: String(form.get("notes") ?? ""),
    isActive: form.get("isActive") !== "off" && form.get("isActive") !== "false",
  };
}

export async function createEmployee(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  const parsed = EmployeeSchema.safeParse(readForm(form));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  const doc = await Employee.create({ shopId: user.shopId, ...parsed.data });
  revalidatePath("/dashboard/settings");
  return { ok: true, id: String(doc._id) };
}

export async function updateEmployee(
  id: string,
  form: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  const parsed = EmployeeSchema.safeParse(readForm(form));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  await Employee.findOneAndUpdate(
    { _id: id, shopId: user.shopId },
    { $set: parsed.data },
    { returnDocument: "after" },
  );
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  // Soft-disable an employee that has paid history; hard-delete only if none.
  const hasHistory = await Expense.exists({
    shopId: user.shopId,
    category: "SALARY",
    employeeId: id,
  });
  if (hasHistory) {
    await Employee.updateOne({ _id: id, shopId: user.shopId }, { $set: { isActive: false } });
  } else {
    await Employee.deleteOne({ _id: id, shopId: user.shopId });
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function paySalary(
  employeeId: string,
  form: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(employeeId))
    return { ok: false, error: "Invalid employee" };

  const parsed = SalaryPaymentSchema.safeParse({
    amount: String(form.get("amount") ?? "0"),
    paymentMethod: String(form.get("paymentMethod") ?? "CASH"),
    date: String(form.get("date") ?? ""),
    period: String(form.get("period") ?? ""),
    branchId: String(form.get("branchId") ?? ""),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  const emp = await Employee.findOne({ _id: employeeId, shopId: user.shopId })
    .select("name branchId")
    .lean<{ _id: Types.ObjectId; name: string; branchId: Types.ObjectId | null } | null>();
  if (!emp) return { ok: false, error: "Employee not found" };

  const period = parsed.data.period
    ? parsed.data.period
    : new Date(parsed.data.date).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });

  await Expense.create({
    shopId: user.shopId,
    category: "SALARY",
    amount: parsed.data.amount,
    paymentMethod: parsed.data.paymentMethod,
    date: parsed.data.date,
    branchId: parsed.data.branchId ?? emp.branchId ?? null,
    note: `Salary — ${emp.name} — ${period}`,
    employeeId,
    createdBy: user.id,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}
