import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import { User } from "@/models";
import { ResetPasswordSchema } from "@/lib/validators";
import { fail, handleError, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = ResetPasswordSchema.parse(body);

    await connectDB();
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return fail("This reset link is invalid or has expired", 400);
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return ok({ reset: true });
  } catch (err) {
    return handleError(err);
  }
}
