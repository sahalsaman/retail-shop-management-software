import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectCloudDB } from "@/lib/mongoose";
import { User, Shop, Branch } from "@/models";
import { LoginSchema } from "@/lib/validators";
import { createSession } from "@/lib/session";
import { fail, handleError, ok } from "@/lib/api";
import { getDb, nowMs, pruneOtherShops, setMeta } from "@/lib/sqlite";
import { startSyncLoop } from "@/lib/sync/tick";
import { isDesktop } from "@/lib/runtime";
import type { Role } from "@/lib/types";

// Login always goes to cloud Mongo — credentials never live in local SQLite.
// On success, the user's shop + branches are mirrored into SQLite so things
// like POS branch lookup and quick-add work offline. The user record itself
// is intentionally NOT cached locally; the JWT carries everything DAL needs.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = LoginSchema.parse(body);

    const conn = await connectCloudDB();
    if (!conn) {
      return fail(
        "No internet connection. Please connect to the network and try again.",
        503,
      );
    }

    const user = await User.findOne({ email: input.email });
    if (!user || !user.isActive) {
      return fail("Invalid email or password", 401);
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      return fail("Invalid email or password", 401);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const userId = user._id.toString();
    const shopId = user.shopId ? user.shopId.toString() : null;
    const branchId = user.branchId ? user.branchId.toString() : null;

    // Mirror shop + branches into SQLite for offline app context. Desktop only
    // — the web build has no local SQLite store and talks to cloud Mongo live.
    if (shopId && isDesktop()) {
      const db = getDb();
      const now = nowMs();

      // Purge anything not belonging to this shop so the local DB only ever
      // holds the active tenant's data.
      pruneOtherShops(shopId);
      setMeta("active_user_id", userId);
      setMeta("active_shop_id", shopId);

      const shop = await Shop.findById(shopId).lean<{
        _id: { toString(): string };
        name: string;
        gstin: string | null;
        stateCode: string | null;
        gstEnabled: boolean | null;
        printerEnabled: boolean | null;
      } | null>();
      if (shop) {
        db.prepare(
          `INSERT INTO shops (id, name, gstin, state_code, gst_enabled, printer_enabled, updated_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, gstin = excluded.gstin, state_code = excluded.state_code,
             gst_enabled = excluded.gst_enabled, printer_enabled = excluded.printer_enabled,
             updated_at = excluded.updated_at, dirty = 0`,
        ).run(
          shopId,
          shop.name,
          shop.gstin ?? null,
          shop.stateCode ?? null,
          shop.gstEnabled === false ? 0 : 1,
          shop.printerEnabled ? 1 : 0,
          now,
        );
      }

      const branches = await Branch.find({ shopId }).lean<
        Array<{
          _id: { toString(): string };
          name: string;
          address: string | null;
          phone: string | null;
          isActive: boolean;
          isDefault: boolean | null;
        }>
      >();
      const insertBranch = db.prepare(
        `INSERT INTO branches (id, shop_id, name, address, phone, is_active, is_default, updated_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, address = excluded.address, phone = excluded.phone,
           is_active = excluded.is_active, is_default = excluded.is_default,
           updated_at = excluded.updated_at, dirty = 0`,
      );
      const tx = db.transaction((rows: typeof branches) => {
        for (const b of rows) {
          insertBranch.run(
            b._id.toString(),
            shopId,
            b.name,
            b.address ?? null,
            b.phone ?? null,
            b.isActive ? 1 : 0,
            b.isDefault ? 1 : 0,
            now,
          );
        }
      });
      tx(branches);
    }

    await createSession({
      userId,
      shopId,
      branchId,
      role: user.role as Role,
      email: user.email,
      name: user.name,
    });

    if (isDesktop()) startSyncLoop();

    return ok({
      user: { id: userId, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return handleError(err);
  }
}
