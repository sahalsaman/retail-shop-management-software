"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus } from "lucide-react";
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
import { adjustStock } from "@/lib/actions/inventory";

export function AdjustStockDialog({
  productId,
  productName,
  branchId,
  currentQty,
  unit,
  hasExpiry = false,
}: {
  productId: string;
  productName: string;
  branchId: string;
  currentQty: number;
  unit: string;
  hasExpiry?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("1");
  const [type, setType] = useState("PURCHASE");
  const [note, setNote] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a positive quantity");
      return;
    }
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("branchId", branchId);
    fd.set("delta", String(direction === "in" ? n : -n));
    fd.set("type", type);
    fd.set("note", note);
    if (hasExpiry && direction === "in") {
      fd.set("batchNo", batchNo);
      fd.set("expiryDate", expiryDate);
    }
    start(async () => {
      const res = await adjustStock(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Stock updated");
      setOpen(false);
      setQty("1");
      setNote("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Adjust
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {productName} · current: {currentQty} {unit}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setDirection("in")}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium ${
                direction === "in" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Stock in
            </button>
            <button
              type="button"
              onClick={() => setDirection("out")}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium ${
                direction === "out" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Minus className="h-3.5 w-3.5" />
              Stock out
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantity</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {direction === "in" ? (
                  <>
                    <option value="PURCHASE">Purchase</option>
                    <option value="OPENING">Opening stock</option>
                    <option value="RETURN_IN">Sale return</option>
                    <option value="TRANSFER_IN">Branch transfer in</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </>
                ) : (
                  <>
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="DAMAGE">Damaged / expired</option>
                    <option value="RETURN_OUT">Return to supplier</option>
                    <option value="TRANSFER_OUT">Branch transfer out</option>
                  </>
                )}
              </Select>
            </div>
          </div>

          {hasExpiry && direction === "in" && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Batch number</Label>
                <Input
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  placeholder="BATCH-2026-A1"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Expiry date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. invoice #123, supplier name…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
