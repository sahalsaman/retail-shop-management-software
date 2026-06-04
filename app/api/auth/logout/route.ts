import { deleteSession } from "@/lib/session";
import { setMeta } from "@/lib/sqlite";
import { isDesktop } from "@/lib/runtime";
import { ok } from "@/lib/api";

export async function POST() {
  await deleteSession();
  // Pause sync. Data tables stay so the next login (same shop) is fast.
  // Desktop only — the web build has no local SQLite store.
  if (isDesktop()) {
    setMeta("active_user_id", null);
    setMeta("active_shop_id", null);
  }
  return ok({ loggedOut: true });
}
