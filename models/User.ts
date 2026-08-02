import { Schema, model, models, Types, type InferSchemaType } from "mongoose";
import { ROLES } from "@/lib/types";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    username: { type: String, default: null, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, default: "OWNER" },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", default: null, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
    pageAccess: { type: [String], default: [] },
    phone: { type: String, default: null, trim: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index(
  { username: 1 },
  { unique: true, sparse: true, partialFilterExpression: { username: { $type: "string" } } },
);
UserSchema.index({ shopId: 1, role: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };
export const User = models.User || model("User", UserSchema);
