"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Employee, Expense, User } from "@/models";
import {
  EmployeeSchema,
  SalaryPaymentSchema,
  type EmployeeInput,
} from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";
import { normalizePageAccess } from "@/lib/permissions";
import type { Role } from "@/lib/types";

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
    canLogin: form.get("canLogin") === "on" || form.get("canLogin") === "true",
    username: String(form.get("username") ?? ""),
    password: String(form.get("password") ?? ""),
    loginRole: String(form.get("loginRole") ?? "CASHIER"),
    pageAccess: form.getAll("pageAccess").map(String),
    isActive: form.get("isActive") !== "off" && form.get("isActive") !== "false",
  };
}

function requireOwner(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return user.role === "OWNER" || user.role === "ADMIN";
}

function employeeData(parsed: EmployeeInput) {
  const { password, ...data } = parsed;
  void password;
  return data;
}

async function usernameTaken(username: string, excludeUserId?: Types.ObjectId | string | null) {
  const q: Record<string, unknown> = {
    $or: [{ username }, { email: username }],
  };
  if (excludeUserId) q._id = { $ne: excludeUserId };
  return User.exists(q);
}

export async function createEmployee(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!requireOwner(user)) return { ok: false, error: "Only owner can manage employees" };
  const parsed = EmployeeSchema.safeParse(readForm(form));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  let userId: Types.ObjectId | null = null;
  if (parsed.data.canLogin) {
    if (!parsed.data.password || parsed.data.password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters" };
    }
    if (await usernameTaken(parsed.data.username!)) {
      return { ok: false, error: "Username already exists" };
    }
    const loginRole = parsed.data.loginRole as Role;
    const loginUser = await User.create({
      name: parsed.data.name,
      email: parsed.data.email ?? parsed.data.username,
      username: parsed.data.username,
      phone: parsed.data.phone,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: loginRole,
      shopId: user.shopId,
      branchId: parsed.data.branchId,
      pageAccess: normalizePageAccess(loginRole, parsed.data.pageAccess),
      isActive: parsed.data.isActive,
    });
    userId = loginUser._id;
  }
  const doc = await Employee.create({ shopId: user.shopId, ...employeeData(parsed.data), userId });
  revalidatePath("/dashboard/settings");
  return { ok: true, id: String(doc._id) };
}

export async function updateEmployee(
  id: string,
  form: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!requireOwner(user)) return { ok: false, error: "Only owner can manage employees" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  const parsed = EmployeeSchema.safeParse(readForm(form));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await connectDB();
  const existing = await Employee.findOne({ _id: id, shopId: user.shopId })
    .select("userId")
    .lean<{ userId: Types.ObjectId | null } | null>();
  if (!existing) return { ok: false, error: "Employee not found" };

  let userId = existing.userId ?? null;
  if (parsed.data.canLogin) {
    if (await usernameTaken(parsed.data.username!, userId)) {
      return { ok: false, error: "Username already exists" };
    }
    if (!userId && (!parsed.data.password || parsed.data.password.length < 8)) {
      return { ok: false, error: "Password must be at least 8 characters" };
    }
    const loginRole = parsed.data.loginRole as Role;
    const userUpdate: Record<string, unknown> = {
      name: parsed.data.name,
      email: parsed.data.email ?? parsed.data.username,
      username: parsed.data.username,
      phone: parsed.data.phone,
      role: loginRole,
      shopId: user.shopId,
      branchId: parsed.data.branchId,
      pageAccess: normalizePageAccess(loginRole, parsed.data.pageAccess),
      isActive: parsed.data.isActive,
    };
    if (parsed.data.password) {
      if (parsed.data.password.length < 8) {
        return { ok: false, error: "Password must be at least 8 characters" };
      }
      userUpdate.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }
    if (userId) {
      await User.updateOne({ _id: userId, shopId: user.shopId }, { $set: userUpdate });
    } else {
      const loginUser = await User.create({
        ...userUpdate,
        passwordHash: userUpdate.passwordHash,
      });
      userId = loginUser._id;
    }
  } else if (userId) {
    await User.updateOne({ _id: userId, shopId: user.shopId }, { $set: { isActive: false } });
  }

  await Employee.findOneAndUpdate(
    { _id: id, shopId: user.shopId },
    { $set: { ...employeeData(parsed.data), userId } },
    { returnDocument: "after" },
  );
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!requireOwner(user)) return { ok: false, error: "Only owner can manage employees" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  const employee = await Employee.findOne({ _id: id, shopId: user.shopId })
    .select("userId")
    .lean<{ userId: Types.ObjectId | null } | null>();
  if (employee?.userId) {
    await User.updateOne(
      { _id: employee.userId, shopId: user.shopId },
      { $set: { isActive: false } },
    );
  }
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
