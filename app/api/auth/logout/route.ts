import { deleteSession } from "@/lib/session";
import { setMeta } from "@/lib/sqlite";
import { ok } from "@/lib/api";

export async function POST() {
  await deleteSession();
  // Pause sync. Data tables stay so the next login (same shop) is fast.
  setMeta("active_user_id", null);
  setMeta("active_shop_id", null);
  return ok({ loggedOut: true });
}
