import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies, type SessionPayload } from "./session";
import { connectDB } from "./mongoose";
import { User } from "@/models";
import type { Role } from "./types";

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await getSessionFromCookies();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  await connectDB();
  const user = await User.findById(session.userId)
    .select("_id name email role shopId branchId phone isActive")
    .lean<{
      _id: { toString(): string };
      name: string;
      email: string;
      role: Role;
      shopId: { toString(): string } | null;
      branchId: { toString(): string } | null;
      phone: string | null;
      isActive: boolean;
    } | null>();

  if (!user || !user.isActive) {
    redirect("/login");
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    shopId: user.shopId ? user.shopId.toString() : null,
    branchId: user.branchId ? user.branchId.toString() : null,
    phone: user.phone,
  };
});

export async function requireRole(allowed: Role[]) {
  const user = await getCurrentUser();
  if (!allowed.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}
