import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectCloudDB } from "@/lib/mongoose";
import { User, Shop, Branch } from "@/models";
import { SignupSchema } from "@/lib/validators";
import { createSession } from "@/lib/session";
import { fail, handleError, ok } from "@/lib/api";
import { getDb, nowMs, pruneOtherShops, setMeta } from "@/lib/sqlite";
import { startSyncLoop } from "@/lib/sync/tick";
import { isDesktop } from "@/lib/runtime";
import { DEFAULT_ROLE_PAGE_ACCESS } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = SignupSchema.parse(body);

    const conn = await connectCloudDB();
    if (!conn) {
      return fail(
        "No internet connection. Please connect to the network and try again.",
        503,
      );
    }

    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) {
      return fail("An account with this email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await User.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: "OWNER",
    });

    const shop = await Shop.create({
      name: input.shopName,
      type: input.shopType,
      ownerId: user._id,
      phone: input.phone,
      email: input.email,
    });

    const branch = await Branch.create({
      shopId: shop._id,
      name: input.branchName || "Main Branch",
      phone: input.phone,
      isMain: true,
    });

    user.shopId = shop._id;
    user.branchId = branch._id;
    user.lastLoginAt = new Date();
    await user.save();

    const userId = user._id.toString();
    const shopId = shop._id.toString();
    const branchId = branch._id.toString();

    // Mirror shop + branch into SQLite for offline app context. Desktop only —
    // the web build has no local SQLite store. User record stays cloud-only;
    // credentials are never persisted locally.
    if (isDesktop()) {
      const db = getDb();
      const now = nowMs();

      pruneOtherShops(shopId);
      setMeta("active_user_id", userId);
      setMeta("active_shop_id", shopId);

      db.prepare(
        `INSERT INTO shops (id, name, gstin, state_code, gst_enabled, printer_enabled, updated_at, dirty)
         VALUES (?, ?, NULL, NULL, 1, 0, ?, 0)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, dirty = 0`,
      ).run(shopId, shop.name, now);
      db.prepare(
        `INSERT INTO branches (id, shop_id, name, address, phone, is_active, is_default, updated_at, dirty)
         VALUES (?, ?, ?, NULL, ?, 1, 1, ?, 0)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, dirty = 0`,
      ).run(branchId, shopId, branch.name, input.phone ?? null, now);
    }

    await createSession({
      userId,
      shopId,
      branchId,
      role: "OWNER",
      email: user.email,
      name: user.name,
      shopName: shop.name,
      pageAccess: DEFAULT_ROLE_PAGE_ACCESS.OWNER,
    });

    if (isDesktop()) startSyncLoop();

    return ok({
      user: { id: userId, name: user.name, email: user.email, role: "OWNER" },
      shop: { id: shopId, name: shop.name, type: shop.type },
    });
  } catch (err) {
    return handleError(err);
  }
}
