"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { paySalary } from "@/lib/actions/employees";

export function PaySalaryDialog({
  employeeId,
  employeeName,
  monthlySalary,
}: {
  employeeId: string;
  employeeName: string;
  monthlySalary: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await paySalary(employeeId, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Salary recorded as expense");
      setOpen(false);
      router.refresh();
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="default" size="sm">
            <Wallet className="h-4 w-4" />
            Pay salary
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {employeeName}</DialogTitle>
          <DialogDescription>
            Records a SALARY expense. Shows up in expenses, P&amp;L, and the
            employee&apos;s history below.
          </DialogDescription>
        </DialogHeader>
        <form id="pay-salary-form" onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Amount ₹</Label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={monthlySalary || ""}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Method</Label>
              <Select name="paymentMethod" defaultValue="CASH">
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input name="date" type="date" defaultValue={today} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Period</Label>
              <Input name="period" defaultValue={month} placeholder="May 2026" />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" form="pay-salary-form" disabled={pending}>
            {pending ? "Saving…" : "Pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
