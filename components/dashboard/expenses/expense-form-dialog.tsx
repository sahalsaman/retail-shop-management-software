"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createExpense } from "@/lib/actions/expenses";
import type { BranchListItem } from "@/lib/queries/branches";

const CATEGORIES = [
  ["RENT", "Rent"],
  ["SALARY", "Salary"],
  ["ELECTRICITY", "Electricity"],
  ["INTERNET", "Internet"],
  ["TRANSPORT", "Transport"],
  ["MAINTENANCE", "Maintenance"],
  ["MARKETING", "Marketing"],
  ["STATIONERY", "Stationery"],
  ["FOOD", "Food"],
  ["OTHER", "Other"],
] as const;

export function ExpenseFormDialog({ branches }: { branches: BranchListItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createExpense(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Expense recorded");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="h-4 w-4" />
            New expense
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>
            Anything that&apos;s a cash outflow but not a supplier purchase.
          </DialogDescription>
        </DialogHeader>
        <form id="expense-form" onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select name="category" defaultValue="OTHER">
                {CATEGORIES.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Amount ₹</Label>
              <Input name="amount" type="number" step="0.01" min="0.01" required autoFocus />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Method</Label>
              <Select name="paymentMethod" defaultValue="CASH">
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Select name="branchId" defaultValue={branches[0]?.id ?? ""}>
                <option value="">— Shop level —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Textarea name="note" rows={2} placeholder="Optional" />
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
