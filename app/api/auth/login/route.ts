import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import { User } from "@/models";
import { LoginSchema } from "@/lib/validators";
import { createSession } from "@/lib/session";
import { fail, handleError, ok } from "@/lib/api";
import type { Role } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = LoginSchema.parse(body);

    await connectDB();

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

    await createSession({
      userId: user._id.toString(),
      shopId: user.shopId ? user.shopId.toString() : null,
      branchId: user.branchId ? user.branchId.toString() : null,
      role: user.role as Role,
      email: user.email,
      name: user.name,
    });

    return ok({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
