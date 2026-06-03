import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies, type SessionPayload } from "./session";
import type { Role } from "./types";

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await getSessionFromCookies();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

// User identity lives in the cloud Mongo users collection. The JWT carries
// everything DAL needs (userId, shopId, branchId, role, email, name) so we
// never have to touch a DB here — keeping the dashboard usable on every page
// load whether the cloud is reachable or not.
export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  return {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    shopId: session.shopId,
    branchId: session.branchId,
    phone: null as string | null,
  };
});

export async function requireRole(allowed: Role[]) {
  const user = await getCurrentUser();
  if (!allowed.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}
