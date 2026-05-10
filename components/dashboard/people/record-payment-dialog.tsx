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

export function RecordPaymentDialog({
  refId,
  label,
  description,
  action,
}: {
  refId: string;
  label: string;
  description: string;
  action: (id: string, fd: FormData) => Promise<{ ok: true } | { ok: false; error: string } | { ok: true; id?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await action(refId, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment recorded");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="default" size="sm">
            <Wallet className="h-4 w-4" />
            {label}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form id="payment-form" onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Amount ₹</Label>
              <Input name="amount" type="number" step="0.01" min="0.01" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Method</Label>
              <Select name="method" defaultValue="CASH">
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Input name="note" placeholder="optional" />
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={pending}>
            {pending ? "Saving…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
