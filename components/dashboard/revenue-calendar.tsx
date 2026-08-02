"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveManualDailySale } from "@/lib/actions/manual-daily-sales";
import { ExpenseFormDialog } from "@/components/dashboard/expenses/expense-form-dialog";
import type { BranchListItem } from "@/lib/queries/branches";

type CalendarDay = {
  date: string;
  day: number;
  billed: number;
  manual: number;
  total: number;
  manualNote: string | null;
  totalExpenses: number;
  expenses: Array<{
    id: string;
    category: string;
    amount: number;
    paymentMethod: string;
    note: string | null;
    branchName: string | null;
  }>;
};

type RevenueCalendarProps = {
  monthKey: string;
  average: number;
  days: CalendarDay[];
  canEdit: boolean;
  branches: BranchListItem[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RevenueCalendar({
  monthKey,
  average,
  days,
  canEdit,
  branches,
}: RevenueCalendarProps) {
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const [editing, setEditing] = useState<CalendarDay | null>(null);
  const monthDate = parseMonth(monthKey);
  const blanks = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();

  return (
    <section className="">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Revenue calendar</h2>
            <p className="text-xs text-muted-foreground">
              Avg selling day: {formatINR(average)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={`/dashboard/calendar?month=${shiftMonth(monthKey, -1)}`} />}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-32 text-center text-sm font-medium">
            {monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={`/dashboard/calendar?month=${shiftMonth(monthKey, 1)}`} />}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="space-y-3 p-3 sm:p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          <Legend color="bg-rose-100 text-rose-800 border-rose-200">Below avg</Legend>
          <Legend color="bg-blue-100 text-blue-800 border-blue-200">Avg day</Legend>
          <Legend color="bg-emerald-100 text-emerald-800 border-emerald-200">Above avg</Legend>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: blanks }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-20 rounded-lg bg-muted/30" />
          ))}
          {days.map((day) => {
            const tone = dayTone(day.total, average);
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelected(day)}
                className={cn(
                  "min-h-20 rounded-lg border p-2 text-left transition-colors sm:min-h-24",
                  toneClass(tone),
                  "hover:ring-2 hover:ring-ring/30",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold">{day.day}</span>
                  <span className="flex items-center gap-1">
                    {day.expenses.length > 0 && (
                      <ReceiptText className="h-3 w-3 opacity-70" />
                    )}
                    {day.manual > 0 && <Pencil className="h-3 w-3 opacity-70" />}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-semibold leading-tight sm:text-xs">
                  {day.total > 0 ? compactINR(day.total) : "-"}
                </div>
                {day.manual > 0 && (
                  <div className="mt-1 text-[10px] opacity-75">
                    Manual {compactINR(day.manual)}
                  </div>
                )}
                {day.totalExpenses > 0 && (
                  <div className="mt-1 text-[10px] opacity-75">
                    Exp {compactINR(day.totalExpenses)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <DayDetailSheet
        day={selected}
        canEdit={canEdit}
        branches={branches}
        onClose={() => setSelected(null)}
        onEdit={(day) => setEditing(day)}
      />

      {editing && (
        <ManualSaleDialog day={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

function DayDetailSheet({
  day,
  canEdit,
  branches,
  onClose,
  onEdit,
}: {
  day: CalendarDay | null;
  canEdit: boolean;
  branches: BranchListItem[];
  onClose: () => void;
  onEdit: (day: CalendarDay) => void;
}) {
  return (
    <Sheet open={!!day} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        {day && (
          <>
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle>{formatDateLabel(day.date)}</SheetTitle>
              <SheetDescription>Day sale and expense details.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {canEdit && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={() => onEdit(day)}>
                    <Plus className="h-4 w-4" />
                    Add sales
                  </Button>
                  <ExpenseFormDialog
                    branches={branches}
                    triggerLabel="Add expense"
                    defaultDate={day.date}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <SummaryBox label="Billed amount" value={formatINR(day.billed)} />
                <SummaryBox label="Manual sale" value={formatINR(day.manual)} />
                <SummaryBox label="Total sales" value={formatINR(day.total)} />
                <SummaryBox label="Expenses" value={formatINR(day.totalExpenses)} />
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">Manual sale</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {day.manualNote ?? "No note added."}
                    </p>
                  </div>
                  {canEdit && (
                    <Button type="button" size="sm" onClick={() => onEdit(day)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">Expenses</h3>
                {day.expenses.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No expenses recorded for this day.
                  </p>
                ) : (
                  <div className="mt-3 divide-y rounded-lg border">
                    {day.expenses.map((expense) => (
                      <div key={expense.id} className="space-y-1 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {expense.category}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {expense.paymentMethod}
                              {expense.branchName ? ` - ${expense.branchName}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold">
                            {formatINR(expense.amount)}
                          </span>
                        </div>
                        {expense.note && (
                          <p className="text-xs text-muted-foreground">{expense.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ManualSaleDialog({
  day,
  onClose,
}: {
  day: CalendarDay;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveManualDailySale({
        dateKey: day.date,
        amount: String(fd.get("amount") ?? "0"),
        note: String(fd.get("note") ?? ""),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Day sale saved");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manual sale - {formatDateLabel(day.date)}</DialogTitle>
        </DialogHeader>
        <form id="manual-day-sale" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
            <Info label="POS billed" value={formatINR(day.billed)} />
            <Info label="Current manual" value={formatINR(day.manual)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Manual sale amount</Label>
            <Input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={day.manual}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Textarea
              name="note"
              rows={2}
              defaultValue={day.manualNote ?? ""}
              placeholder="Example: sales entered from handwritten bill book"
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="manual-day-sale" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full border px-2 py-1", color)}>{children}</span>
  );
}

function dayTone(total: number, average: number) {
  if (total <= 0 || average <= 0) return "empty";
  const tolerance = average * 0.05;
  if (total < average - tolerance) return "below";
  if (total > average + tolerance) return "above";
  return "avg";
}

function toneClass(tone: ReturnType<typeof dayTone>) {
  if (tone === "below") return "border-rose-200 bg-rose-50 text-rose-950";
  if (tone === "avg") return "border-blue-200 bg-blue-50 text-blue-950";
  if (tone === "above") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  return "border-border bg-muted/20 text-muted-foreground";
}

function parseMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function shiftMonth(monthKey: string, delta: number) {
  const d = parseMonth(monthKey);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateLabel(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function compactINR(value: number) {
  if (value >= 100000) return `₹${Math.round(value / 100000)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${Math.round(value)}`;
}
