import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Employee, Expense } from "@/models";

export type EmployeeListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  designation: string;
  monthlySalary: number;
  branchName: string | null;
  branchId: string | null;
  joinedAt: Date;
  notes: string | null;
  isActive: boolean;
  totalPaid: number;
  lastPaidAt: Date | null;
};

export async function listEmployees(
  shopIdStr: string,
): Promise<EmployeeListItem[]> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);

  const docs = await Employee.find({ shopId })
    .sort({ isActive: -1, name: 1 })
    .populate("branchId", "name")
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        phone: string | null;
        email: string | null;
        designation: string;
        monthlySalary: number;
        joinedAt: Date;
        notes: string | null;
        isActive: boolean;
        branchId: { _id: Types.ObjectId; name: string } | null;
      }>
    >();

  const ids = docs.map((d) => d._id);
  const stats = ids.length
    ? await Expense.aggregate<{
        _id: Types.ObjectId;
        total: number;
        last: Date;
      }>([
        {
          $match: {
            shopId,
            category: "SALARY",
            employeeId: { $in: ids },
          },
        },
        {
          $group: {
            _id: "$employeeId",
            total: { $sum: "$amount" },
            last: { $max: "$date" },
          },
        },
      ])
    : [];
  const statMap = new Map(stats.map((s) => [String(s._id), s]));

  return docs.map((d) => {
    const s = statMap.get(String(d._id));
    return {
      id: String(d._id),
      name: d.name,
      phone: d.phone,
      email: d.email,
      designation: d.designation,
      monthlySalary: d.monthlySalary,
      branchName: d.branchId?.name ?? null,
      branchId: d.branchId ? String(d.branchId._id) : null,
      joinedAt: d.joinedAt,
      notes: d.notes,
      isActive: d.isActive,
      totalPaid: s?.total ?? 0,
      lastPaidAt: s?.last ?? null,
    };
  });
}

export async function getEmployeeWithSalaryHistory(
  shopIdStr: string,
  employeeIdStr: string,
) {
  await connectDB();
  if (!Types.ObjectId.isValid(employeeIdStr))
    return { employee: null, salaryHistory: [] };

  const emp = await Employee.findOne({ _id: employeeIdStr, shopId: shopIdStr })
    .populate("branchId", "name")
    .lean<{
      _id: Types.ObjectId;
      name: string;
      phone: string | null;
      email: string | null;
      designation: string;
      monthlySalary: number;
      joinedAt: Date;
      notes: string | null;
      isActive: boolean;
      branchId: { _id: Types.ObjectId; name: string } | null;
    } | null>();
  if (!emp) return { employee: null, salaryHistory: [] };

  const history = await Expense.find({
    shopId: shopIdStr,
    category: "SALARY",
    employeeId: employeeIdStr,
  })
    .sort({ date: -1 })
    .lean<
      Array<{
        _id: Types.ObjectId;
        amount: number;
        paymentMethod: string;
        date: Date;
        note: string | null;
      }>
    >();

  return {
    employee: {
      id: String(emp._id),
      name: emp.name,
      phone: emp.phone,
      email: emp.email,
      designation: emp.designation,
      monthlySalary: emp.monthlySalary,
      branchName: emp.branchId?.name ?? null,
      branchId: emp.branchId ? String(emp.branchId._id) : null,
      joinedAt: emp.joinedAt,
      notes: emp.notes,
      isActive: emp.isActive,
    },
    salaryHistory: history.map((h) => ({
      id: String(h._id),
      amount: h.amount,
      paymentMethod: h.paymentMethod,
      date: h.date,
      period: h.note,
    })),
  };
}
