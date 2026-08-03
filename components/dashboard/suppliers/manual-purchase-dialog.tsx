"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createManualSupplierPurchase } from "@/lib/actions/purchases";

export function ManualPurchaseDialog({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createManualSupplierPurchase(supplierId, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Purchase amount added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            Add purchase amount
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add purchase amount</DialogTitle>
          <DialogDescription>
            Adds a manual purchase entry for {supplierName} without changing stock.
          </DialogDescription>
        </DialogHeader>
        <form id="manual-purchase-form" onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Purchase amount ₹</Label>
              <Input name="amount" type="number" min="0.01" step="0.01" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Paid now ₹</Label>
              <Input name="paidAmount" type="number" min="0" step="0.01" defaultValue="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Payment method</Label>
              <Select name="paymentMethod" defaultValue="CASH">
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="CREDIT">Credit</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input name="date" type="date" defaultValue={localDateKey()} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Textarea name="note" rows={2} placeholder="Example: purchase entered from supplier slip" />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="manual-purchase-form" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
