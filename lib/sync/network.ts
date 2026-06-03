import "server-only";
import { connectCloudDB } from "@/lib/mongoose";

// Probes cloud Mongo. Returns true iff we can reach it within the timeout.
// Used both by the login route (network-only login) and the sync tick.
export async function isCloudReachable(): Promise<boolean> {
  try {
    const conn = await connectCloudDB();
    if (!conn) return false;
    const db = conn.connection.db;
    if (!db) return false;
    await db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
