"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createEmployee, updateEmployee } from "@/lib/actions/employees";
import type { BranchListItem } from "@/lib/queries/branches";
import type { EmployeeListItem } from "@/lib/queries/employees";

const DESIGNATIONS = [
  ["MANAGER", "Manager"],
  ["CASHIER", "Cashier"],
  ["SALES", "Sales floor"],
  ["STOCKROOM", "Stockroom"],
  ["DELIVERY", "Delivery"],
  ["CLEANER", "Cleaner"],
  ["OWNER", "Owner"],
  ["OTHER", "Other"],
] as const;

export function EmployeeFormSheet({
  mode,
  branches,
  employee,
}: {
  mode: "create" | "edit";
  branches: BranchListItem[];
  employee?: EmployeeListItem;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res =
        mode === "create"
          ? await createEmployee(fd)
          : await updateEmployee(employee!.id, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "create" ? "Employee added" : "Employee updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size={mode === "create" ? "default" : "icon-sm"}
            variant={mode === "create" ? "default" : "ghost"}
            aria-label={mode === "edit" ? "Edit employee" : undefined}
          >
            {mode === "create" ? (
              <>
                <Plus className="h-4 w-4" />
                Add employee
              </>
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{mode === "create" ? "Add employee" : "Edit employee"}</SheetTitle>
          <SheetDescription>
            Tracks payroll. Salary payments record into Expenses (SALARY) so
            they show up in P&amp;L and reports.
          </SheetDescription>
        </SheetHeader>

        <form
          id="employee-form"
          onSubmit={submit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
        >
          <Field label="Name" required>
            <Input name="name" required defaultValue={employee?.name ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Designation">
              <Select name="designation" defaultValue={employee?.designation ?? "OTHER"}>
                {DESIGNATIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Branch">
              <Select name="branchId" defaultValue={employee?.branchId ?? ""}>
                <option value="">— Shop level —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input name="phone" defaultValue={employee?.phone ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={employee?.email ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly salary ₹">
              <Input
                name="monthlySalary"
                type="number"
                min="0"
                step="0.01"
                defaultValue={employee?.monthlySalary ?? 0}
              />
            </Field>
            <Field label="Joined on">
              <Input
                name="joinedAt"
                type="date"
                defaultValue={
                  employee?.joinedAt
                    ? new Date(employee.joinedAt).toISOString().slice(0, 10)
                    : new Date().toISOString().slice(0, 10)
                }
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea name="notes" rows={2} defaultValue={employee?.notes ?? ""} />
          </Field>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={employee?.isActive ?? true}
            />
            Active employee
          </label>
        </form>

        <SheetFooter className="border-t px-6 py-4 flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" form="employee-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
