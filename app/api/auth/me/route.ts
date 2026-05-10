import { getSessionFromCookies } from "@/lib/session";
import { fail, ok } from "@/lib/api";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session?.userId) {
    return fail("Not authenticated", 401);
  }
  return ok({
    id: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    shopId: session.shopId,
    branchId: session.branchId,
  });
}
