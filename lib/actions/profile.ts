"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import { User } from "@/models";
import { UpdateProfileSchema, ChangePasswordSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = UpdateProfileSchema.safeParse({
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await connectDB();
  await User.findByIdAndUpdate(user.id, {
    $set: { name: parsed.data.name, phone: parsed.data.phone ?? null },
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changePassword(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: String(form.get("currentPassword") ?? ""),
    newPassword: String(form.get("newPassword") ?? ""),
    confirmPassword: String(form.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await connectDB();
  const doc = await User.findById(user.id).select("passwordHash");
  if (!doc) return { ok: false, error: "User not found" };

  const valid = await bcrypt.compare(parsed.data.currentPassword, doc.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect" };

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await User.updateOne({ _id: user.id }, { $set: { passwordHash: newHash } });

  return { ok: true };
}
