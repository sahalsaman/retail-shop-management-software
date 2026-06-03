import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { SHOP_TYPES } from "@/lib/types";

export const INVITE_STATUS = ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] as const;
export type InviteStatus = (typeof INVITE_STATUS)[number];

const InviteSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    shopName: { type: String, required: true, trim: true },
    shopType: { type: String, enum: SHOP_TYPES, required: true },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, default: null, trim: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: INVITE_STATUS, default: "PENDING", index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    acceptedAt: { type: Date, default: null },
    createdShopId: { type: Schema.Types.ObjectId, ref: "Shop", default: null },
  },
  { timestamps: true }
);

InviteSchema.index({ status: 1, expiresAt: 1 });

export type InviteDoc = InferSchemaType<typeof InviteSchema> & { _id: Types.ObjectId };
export const Invite = models.Invite || model("Invite", InviteSchema);
