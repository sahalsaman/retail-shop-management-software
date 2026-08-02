"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { getCurrentUser } from "@/lib/dal";
import { ManualDailySale } from "@/models";

const ManualDailySaleSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  amount: z.coerce.number().min(0, "Amount cannot be negative"),
  note: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type ManualDailySaleResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveManualDailySale(
  payload: unknown,
): Promise<ManualDailySaleResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return { ok: false, error: "Only owner can add or edit day sales" };
  }

  const parsed = ManualDailySaleSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const shopId = new Types.ObjectId(user.shopId);

  await ManualDailySale.findOneAndUpdate(
    { shopId, dateKey: parsed.data.dateKey },
    {
      $set: {
        amount: parsed.data.amount,
        note: parsed.data.note,
        updatedBy: user.id,
      },
      $setOnInsert: {
        shopId,
        dateKey: parsed.data.dateKey,
        createdBy: user.id,
      },
    },
    { upsert: true },
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}
