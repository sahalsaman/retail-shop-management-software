"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { connectCloudDB } from "@/lib/mongoose";
import { Shop, User, Invite, Branch } from "@/models";
import { CreateInviteSchema, AcceptInviteSchema } from "@/lib/validators";
import { requireRole } from "@/lib/dal";
import { createSession } from "@/lib/session";
import { DEFAULT_ROLE_PAGE_ACCESS } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export type AdminActionResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string };

const INVITE_TTL_DAYS = 7;

export async function createInvite(form: FormData): Promise<AdminActionResult> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = CreateInviteSchema.safeParse({
    email: form.get("email") ?? "",
    ownerName: form.get("ownerName") ?? "",
    phone: form.get("phone") ?? "",
    shopName: form.get("shopName") ?? "",
    shopType: form.get("shopType") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const conn = await connectCloudDB();
  if (!conn) return { ok: false, error: "Cloud Mongo is unreachable" };

  const existingUser = await User.findOne({ email: d.email }).lean();
  if (existingUser) {
    return { ok: false, error: "An account with this email already exists" };
  }
  const openInvite = await Invite.findOne({ email: d.email, status: "PENDING" }).lean();
  if (openInvite) {
    return { ok: false, error: "An invite is already pending for this email" };
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await Invite.create({
    email: d.email,
    ownerName: d.ownerName,
    phone: d.phone ?? null,
    shopName: d.shopName,
    shopType: d.shopType,
    token,
    expiresAt,
    status: "PENDING",
    invitedBy: admin.id,
  });

  revalidatePath("/admin/invites");
  revalidatePath("/admin");

  return {
    ok: true,
    data: { id: String(invite._id), token, expiresAt: expiresAt.toISOString() },
  };
}

export async function revokeInvite(id: string): Promise<AdminActionResult> {
  await requireRole(["ADMIN"]);
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  const conn = await connectCloudDB();
  if (!conn) return { ok: false, error: "Cloud Mongo is unreachable" };
  const res = await Invite.findOneAndUpdate(
    { _id: id, status: "PENDING" },
    { $set: { status: "REVOKED" } },
    { returnDocument: "after" },
  );
  if (!res) return { ok: false, error: "Invite not found or already finalised" };
  revalidatePath("/admin/invites");
  return { ok: true };
}

export async function toggleShopActive(
  id: string,
  active: boolean,
): Promise<AdminActionResult> {
  await requireRole(["ADMIN"]);
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  const conn = await connectCloudDB();
  if (!conn) return { ok: false, error: "Cloud Mongo is unreachable" };
  await Shop.findByIdAndUpdate(id, { $set: { isActive: active } });
  revalidatePath("/admin/shops");
  return { ok: true };
}

export async function acceptInvite(form: FormData): Promise<AdminActionResult> {
  const parsed = AcceptInviteSchema.safeParse({
    token: form.get("token") ?? "",
    password: form.get("password") ?? "",
    branchName: form.get("branchName") ?? "Main Branch",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { token, password, branchName } = parsed.data;

  const conn = await connectCloudDB();
  if (!conn) {
    return { ok: false, error: "No internet connection. Please connect to the network and try again." };
  }

  const invite = await Invite.findOne({ token });
  if (!invite) return { ok: false, error: "Invalid invite link" };
  if (invite.status !== "PENDING") {
    return { ok: false, error: `Invite ${invite.status.toLowerCase()}` };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    invite.status = "EXPIRED";
    await invite.save();
    return { ok: false, error: "Invite has expired" };
  }

  const existingUser = await User.findOne({ email: invite.email }).lean();
  if (existingUser) {
    return { ok: false, error: "An account with this email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const owner = await User.create({
    name: invite.ownerName,
    email: invite.email,
    phone: invite.phone,
    passwordHash,
    role: "OWNER" satisfies Role,
  });

  const shop = await Shop.create({
    name: invite.shopName,
    type: invite.shopType,
    ownerId: owner._id,
    phone: invite.phone,
    email: invite.email,
  });

  const branch = await Branch.create({
    shopId: shop._id,
    name: branchName,
    phone: invite.phone,
    isMain: true,
  });

  owner.shopId = shop._id;
  owner.branchId = branch._id;
  owner.lastLoginAt = new Date();
  await owner.save();

  invite.status = "ACCEPTED";
  invite.acceptedAt = new Date();
  invite.createdShopId = shop._id;
  await invite.save();

  // Auto-login the new owner.
  await createSession({
    userId: owner._id.toString(),
    shopId: shop._id.toString(),
    branchId: branch._id.toString(),
    role: "OWNER",
    email: owner.email,
    name: owner.name,
    shopName: shop.name,
    pageAccess: DEFAULT_ROLE_PAGE_ACCESS.OWNER,
  });

  revalidatePath("/admin/invites");
  revalidatePath("/admin/shops");

  return {
    ok: true,
    data: {
      shopId: shop._id.toString(),
      ownerId: owner._id.toString(),
    },
  };
}
