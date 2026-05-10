"use client";

import { useState, useMemo, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/format";
import { createPurchase } from "@/lib/actions/purchases";
import type { BranchListItem } from "@/lib/queries/branches";

type Supplier = { id: string; name: string; phone: string | null; gstin: string | null };

type ProductHit = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  gstRate: number;
  hasExpiry?: boolean;
};

type Line = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  quantity: string;
  unitCost: string;
  gstRate: string;
  batchNo: string;
  expiryDate: string;
  hasExpiry: boolean;
};

export function PurchaseForm({
  branches,
  initialBranchId,
  initialSupplier,
  gstEnabled = true,
}: {
  branches: BranchListItem[];
  initialBranchId: string;
  initialSupplier: Supplier | null;
  gstEnabled?: boolean;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(initialBranchId);
  const [supplier, setSupplier] = useState<Supplier | null>(initialSupplier);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [intraState, setIntraState] = useState(true);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, start] = useTransition();

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    for (const l of lines) {
      const q = Number(l.quantity) || 0;
      const c = Number(l.unitCost) || 0;
      const gst = Number(l.gstRate) || 0;
      const gross = q * c;
      const tax = gstEnabled ? (gross * gst) / 100 : 0;
      subtotal += gross;
      totalTax += tax;
    }
    return {
      subtotal,
      totalTax,
      cgst: gstEnabled && intraState ? totalTax / 2 : 0,
      sgst: gstEnabled && intraState ? totalTax / 2 : 0,
      igst: gstEnabled && !intraState ? totalTax : 0,
      total: subtotal + totalTax,
    };
  }, [lines, intraState, gstEnabled]);

  function addLine(p: ProductHit) {
    if (lines.find((l) => l.productId === p.id)) {
      toast.error("Already in invoice");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        quantity: "1",
        unitCost: "0",
        gstRate: String(p.gstRate),
        batchNo: "",
        expiryDate: "",
        hasExpiry: !!p.hasExpiry,
      },
    ]);
  }

  function setLineField<K extends keyof Line>(idx: number, key: K, value: Line[K]) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    if (!supplier) {
      toast.error("Pick a supplier");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("Invoice number required");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    start(async () => {
      const res = await createPurchase({
        branchId,
        supplierId: supplier.id,
        invoiceNumber,
        paidAmount: paidAmount === "" ? 0 : Number(paidAmount),
        paymentMethod,
        intraState,
        notes,
        items: lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          sku: l.sku,
          quantity: Number(l.quantity),
          unit: l.unit,
          unitCost: Number(l.unitCost),
          gstRate: gstEnabled ? Number(l.gstRate) : 0,
          batchNo: l.batchNo,
          expiryDate: l.expiryDate,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invoice ${res.invoiceNumber} saved`);
      router.push("/dashboard/purchases");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Invoice number *</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="From the supplier's bill"
              />
            </div>
          </div>

          <SupplierPicker supplier={supplier} onChange={setSupplier} />

          <ProductSearch onAdd={addLine} branchId={branchId} />

          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wide border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-right px-2 py-2 font-medium w-20">Qty</th>
                  <th className="text-right px-2 py-2 font-medium w-24">Cost ₹</th>
                  {gstEnabled && (
                    <th className="text-right px-2 py-2 font-medium w-16">GST</th>
                  )}
                  <th className="text-right px-2 py-2 font-medium w-28">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={gstEnabled ? 6 : 5}
                      className="text-center py-10 text-muted-foreground"
                    >
                      Search above to add line items.
                    </td>
                  </tr>
                ) : (
                  lines.map((l, idx) => {
                    const q = Number(l.quantity) || 0;
                    const c = Number(l.unitCost) || 0;
                    const gst = Number(l.gstRate) || 0;
                    const gross = q * c;
                    const tax = (gross * gst) / 100;
                    return (
                      <tr key={l.productId} className="border-b last:border-0 align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {l.sku} · {l.unit}
                          </div>
                          {l.hasExpiry && (
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              <Input
                                placeholder="Batch"
                                value={l.batchNo}
                                onChange={(e) => setLineField(idx, "batchNo", e.target.value)}
                              />
                              <Input
                                type="date"
                                value={l.expiryDate}
                                onChange={(e) => setLineField(idx, "expiryDate", e.target.value)}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            className="text-right"
                            min="0"
                            step="any"
                            value={l.quantity}
                            onChange={(e) => setLineField(idx, "quantity", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            className="text-right"
                            min="0"
                            step="0.01"
                            value={l.unitCost}
                            onChange={(e) => setLineField(idx, "unitCost", e.target.value)}
                          />
                        </td>
                        {gstEnabled && (
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              className="text-right"
                              min="0"
                              step="0.01"
                              value={l.gstRate}
                              onChange={(e) => setLineField(idx, "gstRate", e.target.value)}
                            />
                          </td>
                        )}
                        <td className="px-2 py-2 text-right font-medium">
                          {formatINR(gross + tax)}
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLine(idx)}
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional internal notes"
            />
          </div>
        </div>

        <aside className="space-y-3 rounded-xl border bg-card p-4 h-fit">
          <h2 className="font-medium">Totals</h2>
          <Row label="Subtotal">{formatINR(totals.subtotal)}</Row>
          {gstEnabled &&
            (intraState ? (
              <>
                <Row label="CGST">{formatINR(totals.cgst)}</Row>
                <Row label="SGST">{formatINR(totals.sgst)}</Row>
              </>
            ) : (
              <Row label="IGST">{formatINR(totals.igst)}</Row>
            ))}
          <div className="rounded-xl bg-muted/60 p-3 flex items-baseline justify-between">
            <span className="text-sm font-medium">Grand total</span>
            <span className="text-xl font-semibold">{formatINR(totals.total)}</span>
          </div>

          {gstEnabled && (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={intraState}
                onChange={(e) => setIntraState(e.target.checked)}
              />
              Intra-state (CGST + SGST)
            </label>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Paid ₹</Label>
              <Input
                type="number"
                value={paidAmount}
                placeholder="0"
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Method</Label>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="CREDIT">Credit</option>
              </Select>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={pending || lines.length === 0 || !supplier}
            onClick={submit}
          >
            {pending ? "Saving…" : "Save invoice"}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function ProductSearch({
  onAdd,
  branchId,
}: {
  onAdd: (p: ProductHit) => void;
  branchId: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(term)}&branch=${branchId}`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as { items: ProductHit[] };
        setResults(data.items);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, branchId]);

  return (
    <div>
      <Label className="text-xs text-muted-foreground">Add items</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="h-10 pl-9"
          placeholder="Search products by name, SKU…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {q && (
        <div className="mt-2 rounded-xl border max-h-56 overflow-y-auto divide-y">
          {searching && results.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          )}
          {!searching && results.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No matches.</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onAdd(r);
                setQ("");
                setResults([]);
                inputRef.current?.focus();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/60"
            >
              <div>
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {r.sku} · {r.unit}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">GST {r.gstRate}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierPicker({
  supplier,
  onChange,
}: {
  supplier: Supplier | null;
  onChange: (s: Supplier | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Supplier[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/suppliers/search?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as { items: Supplier[] };
        setResults(data.items);
        setShowResults(true);
      } catch {
        // ignore
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  if (supplier) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{supplier.name}</div>
          <div className="text-xs text-muted-foreground">
            {supplier.phone ?? "no phone"}
            {supplier.gstin ? ` · GSTIN ${supplier.gstin}` : ""}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(null)}
          aria-label="Remove supplier"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Label className="text-xs text-muted-foreground">Supplier *</Label>
      <Input
        placeholder="Search supplier by name or phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setShowResults(true)}
      />
      {showResults && q && (
        <div className="absolute left-0 right-0 mt-1 z-20 rounded-xl border bg-card max-h-56 overflow-y-auto divide-y shadow-md">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No matches.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange(r);
                  setQ("");
                  setShowResults(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/60"
              >
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.phone ?? "—"}</div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
