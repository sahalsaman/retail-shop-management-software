import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { PAYMENT_METHODS } from "@/lib/types";

const EXPENSE_CATEGORIES = [
  "RENT",
  "SALARY",
  "ELECTRICITY",
  "INTERNET",
  "TRANSPORT",
  "MAINTENANCE",
  "MARKETING",
  "STATIONERY",
  "FOOD",
  "OTHER",
] as const;

const ExpenseSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "CASH" },
    note: { type: String, default: null, trim: true },
    date: { type: Date, default: () => new Date(), required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ExpenseSchema.index({ shopId: 1, date: -1 });
ExpenseSchema.index({ shopId: 1, category: 1, date: -1 });

export type ExpenseDoc = InferSchemaType<typeof ExpenseSchema> & { _id: Types.ObjectId };
export const Expense = models.Expense || model("Expense", ExpenseSchema);
export { EXPENSE_CATEGORIES };
