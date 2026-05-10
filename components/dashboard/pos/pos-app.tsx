"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  Search,
  Trash2,
  User,
  X,
  CreditCard,
  Wallet,
  Smartphone,
  Receipt,
  PauseCircle,
  Printer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { finalizeSale, holdSale, discardHeldSale } from "@/lib/actions/pos";
import type { BranchListItem } from "@/lib/queries/branches";
import type { HeldSale } from "@/lib/queries/sales";

type PosCustomer = {
  id: string;
  name: string;
  phone: string;
  creditBalance: number;
};

type PosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  gstRate: number;
  sellingPrice: number;
  mrp: number | null;
  stock: number;
};

type CartLine = {
  productId: string;
  name: string;
  sku: string | null;
  hsnCode: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  gstRate: number;
};

export function PosApp({
  branches,
  initialBranchId,
  shopGstin,
  shopStateCode,
  gstEnabled,
  thermalPrint = false,
  heldSales,
}: {
  branches: BranchListItem[];
  initialBranchId: string;
  shopGstin: string | null;
  shopStateCode: string | null;
  gstEnabled: boolean;
  thermalPrint?: boolean;
  heldSales: HeldSale[];
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(initialBranchId);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [resumeFromId, setResumeFromId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] =
    useState<"CASH" | "UPI" | "CARD" | "CREDIT">("CASH");
  const [paidInput, setPaidInput] = useState("");
  const [intraState, setIntraState] = useState(true);
  const [pending, start] = useTransition();
  const [held, setHeld] = useState<HeldSale[]>(heldSales);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(q)}&branch=${branchId}&limit=15`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as { items: PosProduct[] };
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
  }, [query, branchId]);

  // Hotkey: focus search on "/"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function addToCart(p: PosProduct) {
    if (p.stock <= 0) {
      toast.error(`${p.name} is out of stock`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        if (next[idx].quantity + 1 > p.stock) {
          toast.error(`Only ${p.stock} ${p.unit} in stock`);
          return prev;
        }
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          hsnCode: null,
          quantity: 1,
          unit: p.unit,
          unitPrice: p.sellingPrice,
          discount: 0,
          gstRate: p.gstRate,
        },
      ];
    });
    setQuery("");
    setResults([]);
    searchInputRef.current?.focus();
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.max(0, l.quantity + delta) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  function setQty(productId: string, qty: number) {
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, quantity: Math.max(0, qty) } : l,
      ),
    );
  }

  function setLineDiscount(productId: string, disc: number) {
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, discount: Math.max(0, disc) } : l,
      ),
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setCustomer(null);
    setDiscount("0");
    setPaidInput("");
    setResumeFromId(null);
    setPaymentMethod("CASH");
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    for (const l of cart) {
      const gross = l.quantity * l.unitPrice;
      const afterDisc = Math.max(0, gross - l.discount);
      const tax = gstEnabled ? (afterDisc * l.gstRate) / 100 : 0;
      subtotal += afterDisc;
      totalTax += tax;
    }
    const billDisc = Number(discount) || 0;
    const cgst = gstEnabled && intraState ? totalTax / 2 : 0;
    const sgst = gstEnabled && intraState ? totalTax / 2 : 0;
    const igst = gstEnabled && !intraState ? totalTax : 0;
    const grand = subtotal + totalTax - billDisc;
    const rounded = Math.round(grand);
    const roundOff = rounded - grand;
    return {
      subtotal,
      totalTax,
      cgst,
      sgst,
      igst,
      billDisc,
      roundOff,
      total: grand + roundOff,
      itemCount: cart.reduce((acc, l) => acc + l.quantity, 0),
    };
  }, [cart, discount, intraState, gstEnabled]);

  const paidAmount =
    paidInput === ""
      ? paymentMethod === "CREDIT"
        ? 0
        : totals.total
      : Number(paidInput) || 0;
  const change = paidAmount - totals.total;

  function resumeHeld(h: HeldSale) {
    setCart(
      h.items.map((it) => ({
        productId: it.productId,
        name: it.name,
        sku: it.sku,
        hsnCode: null,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discount: it.discount,
        gstRate: it.gstRate,
      })),
    );
    setResumeFromId(h.id);
    toast.success(`Resumed ${h.billNumber}`);
  }

  function dropHeld(id: string) {
    start(async () => {
      const res = await discardHeldSale(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHeld((prev) => prev.filter((h) => h.id !== id));
      toast.success("Discarded");
    });
  }

  function doHold() {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    start(async () => {
      const res = await holdSale({
        branchId,
        customerId: customer?.id ?? null,
        paymentMethod,
        paidAmount: 0,
        discount: Number(discount) || 0,
        intraState,
        items: gstEnabled ? cart : cart.map((c) => ({ ...c, gstRate: 0 })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Bill held");
      clearCart();
      router.refresh();
    });
  }

  function doFinalize() {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (paymentMethod === "CREDIT" && !customer) {
      toast.error("Credit sale requires a customer");
      return;
    }
    start(async () => {
      const res = await finalizeSale({
        branchId,
        customerId: customer?.id ?? null,
        paymentMethod,
        paidAmount,
        discount: Number(discount) || 0,
        intraState,
        items: gstEnabled
          ? cart
          : cart.map((c) => ({ ...c, gstRate: 0 })),
        resumeFromId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Bill ${res.billNumber} created`);
      clearCart();
      const printRoute = thermalPrint
        ? `/dashboard/pos/thermal/${res.saleId}`
        : `/dashboard/pos/print/${res.saleId}`;
      window.open(printRoute, "_blank", "noopener");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(360px,420px)] h-full">
      <div className="flex flex-col gap-4 min-h-0">
        <header className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
            <p className="text-sm text-muted-foreground">
              Press <kbd className="px-1 rounded border bg-muted text-xs">/</kbd> to
              search · scan a barcode at any time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="h-10 w-44"
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                clearCart();
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <HeldDialog
              held={held}
              onResume={resumeHeld}
              onDiscard={dropHeld}
              pending={pending}
            />
          </div>
        </header>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            className="h-12 pl-10 text-base"
            placeholder="Scan barcode or search by name / SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                addToCart(results[0]);
              }
            }}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {query && (
          <div className="rounded-xl border max-h-72 overflow-y-auto divide-y">
            {searching && results.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Searching…</p>
            )}
            {!searching && results.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No matches.</p>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => addToCart(r)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {r.sku} · {r.unit}
                    {r.barcode ? ` · ${r.barcode}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{formatINR(r.sellingPrice)}</div>
                  <div className="text-xs text-muted-foreground">
                    Stock: {r.stock} {r.unit}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border bg-card flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full grid place-items-center p-12 text-center">
              <div>
                <Receipt className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Start scanning or searching to build a bill.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wide">
                <tr className="border-b">
                  <th className="text-left px-4 py-2 font-medium">Item</th>
                  <th className="text-center px-2 py-2 font-medium w-32">Qty</th>
                  <th className="text-right px-2 py-2 font-medium w-24">Price</th>
                  <th className="text-right px-2 py-2 font-medium w-24">Disc</th>
                  {gstEnabled && (
                    <th className="text-right px-2 py-2 font-medium w-20">GST</th>
                  )}
                  <th className="text-right px-3 py-2 font-medium w-28">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {cart.map((l) => {
                  const gross = l.quantity * l.unitPrice;
                  const afterDisc = Math.max(0, gross - l.discount);
                  const tax = gstEnabled ? (afterDisc * l.gstRate) / 100 : 0;
                  return (
                    <tr key={l.productId} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {l.sku ?? ""}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => changeQty(l.productId, -1)}
                            aria-label="Decrease"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            className="h-7 w-14 text-center px-1"
                            value={l.quantity}
                            onChange={(e) =>
                              setQty(l.productId, Number(e.target.value) || 0)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => changeQty(l.productId, 1)}
                            aria-label="Increase"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {formatINR(l.unitPrice)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          type="number"
                          className="h-7 w-20 text-right px-1"
                          value={l.discount}
                          onChange={(e) =>
                            setLineDiscount(l.productId, Number(e.target.value) || 0)
                          }
                        />
                      </td>
                      {gstEnabled && (
                        <td className="px-2 py-2 text-right text-muted-foreground">
                          {l.gstRate}%
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-medium">
                        {formatINR(afterDisc + tax)}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeLine(l.productId)}
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <CustomerPicker customer={customer} onChange={setCustomer} />

        <div className="space-y-2 pt-1 text-sm">
          <Row label="Items">{totals.itemCount}</Row>
          <Row label="Subtotal">{formatINR(totals.subtotal)}</Row>
          {gstEnabled &&
            (intraState ? (
              <>
                <Row label="CGST" muted>
                  {formatINR(totals.cgst)}
                </Row>
                <Row label="SGST" muted>
                  {formatINR(totals.sgst)}
                </Row>
              </>
            ) : (
              <Row label="IGST" muted>
                {formatINR(totals.igst)}
              </Row>
            ))}
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm text-muted-foreground">Bill discount ₹</Label>
            <Input
              type="number"
              className="h-8 w-28 text-right"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <Row label="Round-off" muted>
            {formatINR(totals.roundOff)}
          </Row>
        </div>

        <div className="rounded-xl bg-muted/60 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Grand total</span>
            <span className="text-2xl font-semibold">{formatINR(totals.total)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Payment method</Label>
          <div className="grid grid-cols-4 gap-1.5">
            <PayPill
              label="Cash"
              icon={Wallet}
              active={paymentMethod === "CASH"}
              onClick={() => setPaymentMethod("CASH")}
            />
            <PayPill
              label="UPI"
              icon={Smartphone}
              active={paymentMethod === "UPI"}
              onClick={() => setPaymentMethod("UPI")}
            />
            <PayPill
              label="Card"
              icon={CreditCard}
              active={paymentMethod === "CARD"}
              onClick={() => setPaymentMethod("CARD")}
            />
            <PayPill
              label="Credit"
              icon={Receipt}
              active={paymentMethod === "CREDIT"}
              onClick={() => setPaymentMethod("CREDIT")}
            />
          </div>
        </div>

        {paymentMethod === "UPI" && (
          <UpiQrButton
            amount={totals.total}
            payee={shopGstin ?? "RSMS"}
          />
        )}

        {paymentMethod !== "CREDIT" && (
          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Paid ₹</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={paidInput}
                placeholder={String(totals.total.toFixed(2))}
                onChange={(e) => setPaidInput(e.target.value)}
              />
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Change</div>
              <div
                className={`text-lg font-semibold ${
                  change < 0 ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {change < 0 ? "Due " : ""}
                {formatINR(Math.abs(change))}
              </div>
            </div>
          </div>
        )}

        {gstEnabled && (
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={intraState}
              onChange={(e) => setIntraState(e.target.checked)}
            />
            Intra-state (CGST + SGST)
            {shopStateCode && (
              <span className="ml-auto font-mono">{shopStateCode}</span>
            )}
          </label>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            onClick={doHold}
            disabled={pending || cart.length === 0}
          >
            <PauseCircle className="h-4 w-4" />
            Hold
          </Button>
          <Button
            onClick={doFinalize}
            disabled={pending || cart.length === 0}
          >
            {pending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Pay & print
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={clearCart}
          disabled={pending || (cart.length === 0 && !customer)}
          size="sm"
        >
          Clear
        </Button>
      </aside>
    </div>
  );
}

function Row({
  label,
  children,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-sm text-muted-foreground" : "text-sm"}>
        {label}
      </span>
      <span className={muted ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
        {children}
      </span>
    </div>
  );
}

function PayPill({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Wallet;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-input bg-card hover:bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CustomerPicker({
  customer,
  onChange,
}: {
  customer: PosCustomer | null;
  onChange: (c: PosCustomer | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PosCustomer[]>([]);
  const [open, setOpen] = useState(false);

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
          `/api/customers/search?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as { items: PosCustomer[] };
        setResults(data.items);
      } catch {
        // ignore
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  if (customer) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{customer.name}</div>
          <div className="text-xs text-muted-foreground">
            {customer.phone} · Credit {formatINR(customer.creditBalance)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(null)}
          aria-label="Remove customer"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="justify-start gap-2">
            <User className="h-4 w-4" />
            Walk-in customer
            <Badge variant="secondary" className="ml-auto">
              Add
            </Badge>
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach customer</DialogTitle>
          <DialogDescription>
            Search by phone or name.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="max-h-72 overflow-y-auto divide-y rounded-lg border">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {q ? "No matches." : "Type to search."}
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                  setQ("");
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/60"
              >
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.phone}</div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatINR(r.creditBalance)}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HeldDialog({
  held,
  onResume,
  onDiscard,
  pending,
}: {
  held: HeldSale[];
  onResume: (h: HeldSale) => void;
  onDiscard: (id: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <PauseCircle className="h-4 w-4" />
            Held ({held.length})
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Held bills</DialogTitle>
          <DialogDescription>Resume or discard.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto divide-y rounded-lg border">
          {held.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No held bills.</p>
          ) : (
            held.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium font-mono">
                    {h.billNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.itemCount} items · {formatINR(h.total)}
                    {h.customerName ? ` · ${h.customerName}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onResume(h);
                      setOpen(false);
                    }}
                  >
                    Resume
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDiscard(h.id)}
                    disabled={pending}
                    aria-label="Discard"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UpiQrButton({ amount, payee }: { amount: number; payee: string }) {
  const [open, setOpen] = useState(false);
  const upi = `upi://pay?pa=${encodeURIComponent(payee.toLowerCase())}@upi&pn=${encodeURIComponent("RSMS")}&am=${amount.toFixed(2)}&cu=INR`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Smartphone className="h-4 w-4" />
            Show UPI link
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>UPI payment</DialogTitle>
          <DialogDescription>
            Open this URI in any UPI app or paste it into a QR generator.
            Phase 6 will render this as a real QR.
          </DialogDescription>
        </DialogHeader>
        <code className="block break-all rounded-lg bg-muted p-3 text-xs">
          {upi}
        </code>
        <DialogFooter>
          <Button onClick={() => navigator.clipboard.writeText(upi)}>
            Copy URI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
