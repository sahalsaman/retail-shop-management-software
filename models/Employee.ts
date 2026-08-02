import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const EMPLOYEE_DESIGNATIONS = [
  "OWNER",
  "MANAGER",
  "CASHIER",
  "SALES",
  "STOCKROOM",
  "DELIVERY",
  "CLEANER",
  "OTHER",
] as const;

const EmployeeSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: null, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    designation: {
      type: String,
      enum: EMPLOYEE_DESIGNATIONS,
      default: "OTHER",
      required: true,
    },
    monthlySalary: { type: Number, default: 0, min: 0 },
    joinedAt: { type: Date, default: () => new Date() },
    notes: { type: String, default: null, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    canLogin: { type: Boolean, default: false },
    username: { type: String, default: null, lowercase: true, trim: true },
    loginRole: {
      type: String,
      enum: ["MANAGER", "CASHIER", "SALES_EXECUTIVE"],
      default: "CASHIER",
    },
    pageAccess: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

EmployeeSchema.index({ shopId: 1, name: 1 });
EmployeeSchema.index({ shopId: 1, branchId: 1, isActive: 1 });
EmployeeSchema.index(
  { username: 1 },
  { unique: true, sparse: true, partialFilterExpression: { username: { $type: "string" } } },
);

export type EmployeeDoc = InferSchemaType<typeof EmployeeSchema> & {
  _id: Types.ObjectId;
};
export const Employee = models.Employee || model("Employee", EmployeeSchema);
export { EMPLOYEE_DESIGNATIONS };
