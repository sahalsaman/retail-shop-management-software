import { Users, AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getShopSettings, type ShopSettings } from "@/lib/queries/shop";
import { listBranches } from "@/lib/queries/branches";
import { listEmployees } from "@/lib/queries/employees";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatDate } from "@/lib/format";
import { SettingsNav } from "@/components/dashboard/settings/settings-nav";
import { ShopProfileForm } from "@/components/dashboard/settings/shop-profile-form";
import { ShopTaxForm } from "@/components/dashboard/settings/shop-tax-form";
import { ShopPrinterForm } from "@/components/dashboard/settings/shop-printer-form";
import { EmployeeFormSheet } from "@/components/dashboard/settings/employee-form-sheet";
import { PaySalaryDialog } from "@/components/dashboard/settings/pay-salary-dialog";
import { DeleteEmployeeButton } from "@/components/dashboard/settings/delete-employee-button";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) redirect("/dashboard");

  const sp = await searchParams;
  const section = (typeof sp.section === "string" ? sp.section : "profile") as
    | "profile"
    | "tax"
    | "printer"
    | "employees";

  const shop = (await getShopSettings(user.shopId)) ?? fallbackShopSettings(user.shopId, user.shopName);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Shop profile, tax, and employee payroll.
        </p>
      </header>

      <SettingsNav />

      {section === "profile" && <ShopProfileForm shop={shop} />}
      {section === "tax" && <ShopTaxForm shop={shop} />}
      {section === "printer" && <ShopPrinterForm shop={shop} />}
      {section === "employees" && <EmployeesSection shopId={user.shopId} />}
    </div>
  );
}

function fallbackShopSettings(shopId: string, shopName: string | null): ShopSettings {
  return {
    id: shopId,
    name: shopName?.trim() || "Your Shop",
    type: "OTHER",
    gstin: null,
    gstEnabled: true,
    address: null,
    phone: null,
    email: null,
    currency: "INR",
    locale: "en-IN",
    isActive: true,
    printer: {
      enabled: false,
      paperWidth: "80mm",
      header: null,
      footer: null,
      copies: 1,
      autoPrint: true,
    },
  };
}

async function EmployeesSection({ shopId }: { shopId: string }) {
  const [branches, employees] = await Promise.all([
    listBranches(shopId),
    listEmployees(shopId),
  ]);

  const totalMonthly = employees
    .filter((e) => e.isActive)
    .reduce((acc, e) => acc + e.monthlySalary, 0);
  const activeCount = employees.filter((e) => e.isActive).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h2 className="text-lg font-semibold">Employees</h2>
          <p className="text-sm text-muted-foreground">
            {activeCount} active · {formatINR(totalMonthly)} monthly payroll
          </p>
        </div>
        <EmployeeFormSheet mode="create" branches={branches} />
      </div>

      {employees.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">
            No employees yet. Add the first one to start tracking payroll.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>App access</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Monthly ₹</TableHead>
                <TableHead className="text-right">Paid total</TableHead>
                <TableHead>Last paid</TableHead>
                <TableHead className="text-right w-72">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="font-medium">{e.name}</div>
                    {e.phone && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {e.phone}
                      </div>
                    )}
                    {!e.isActive && (
                      <Badge variant="outline" className="ml-1">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.designation}
                  </TableCell>
                  <TableCell>
                    {e.canLogin ? (
                      <div className="space-y-1">
                        <Badge variant="secondary">{e.loginRole}</Badge>
                        <div className="text-xs text-muted-foreground font-mono">
                          {e.username}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.branchName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.monthlySalary > 0 ? formatINR(e.monthlySalary) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.totalPaid > 0 ? formatINR(e.totalPaid) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.lastPaidAt ? formatDate(e.lastPaidAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1 justify-end">
                      {e.isActive && (
                        <PaySalaryDialog
                          employeeId={e.id}
                          employeeName={e.name}
                          monthlySalary={e.monthlySalary}
                        />
                      )}
                      <EmployeeFormSheet
                        mode="edit"
                        branches={branches}
                        employee={e}
                      />
                      <DeleteEmployeeButton id={e.id} name={e.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5" />
        Salary payments record into{" "}
        <a className="underline" href="/dashboard/expenses?category=SALARY">
          Expenses → Salary
        </a>{" "}
        and roll into the P&amp;L report.
      </p>
    </div>
  );
}
