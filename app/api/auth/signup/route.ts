import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import { User, Shop, Branch } from "@/models";
import { SignupSchema } from "@/lib/validators";
import { createSession } from "@/lib/session";
import { fail, handleError, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = SignupSchema.parse(body);

    await connectDB();

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

    await createSession({
      userId: user._id.toString(),
      shopId: shop._id.toString(),
      branchId: branch._id.toString(),
      role: "OWNER",
      email: user.email,
      name: user.name,
    });

    return ok({
      user: { id: user._id.toString(), name: user.name, email: user.email, role: "OWNER" },
      shop: { id: shop._id.toString(), name: shop.name, type: shop.type },
    });
  } catch (err) {
    return handleError(err);
  }
}
