import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { connectDB } from "@/lib/mongoose";
import { User } from "@/models";
import { ForgotPasswordSchema } from "@/lib/validators";
import { handleError, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = ForgotPasswordSchema.parse(body);

    await connectDB();
    const user = await User.findOne({ email });

    // Always return ok to avoid leaking which emails exist.
    if (!user || !user.isActive) {
      return ok({ sent: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    // TODO: send via email/SMS once provider is wired up.
    const devToken = process.env.NODE_ENV !== "production" ? token : undefined;
    return ok({ sent: true, devToken });
  } catch (err) {
    return handleError(err);
  }
}
