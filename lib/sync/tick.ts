import "server-only";
import { getMeta } from "@/lib/sqlite";
import { isCloudReachable } from "./network";
import { drainOutbox } from "./outbox";
import { pullAll } from "./pull";

// Background sync loop. Started once per Next server process via startSyncLoop().
// Per-tick (default 30s):
//   1. Skip entirely if no one is logged in (active_shop_id unset).
//   2. Check cloud reachability.
//   3. If reachable: drain outbox to cloud, then pull cloud → local (filtered to active shop).

const TICK_MS = 30_000;

const g = globalThis as unknown as { _rsmsSyncStarted?: boolean };

export function startSyncLoop(): void {
  if (g._rsmsSyncStarted) return;
  g._rsmsSyncStarted = true;

  const tick = async () => {
    try {
      if (!getMeta("active_shop_id")) return; // nobody logged in
      if (!(await isCloudReachable())) return;
      await drainOutbox();
      await pullAll();
    } catch (err) {
      console.warn("[sync] tick error:", err);
    }
  };

  setTimeout(() => void tick(), 2000);
  setInterval(() => void tick(), TICK_MS).unref?.();
}
