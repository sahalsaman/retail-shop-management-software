"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  User,
  X,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/format";

type ProductHit = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: number;
};

type CustomerHit = {
  id: string;
  name: string;
  phone: string;
  creditBalance: number;
};

type FlatHit =
  | { kind: "product"; data: ProductHit }
  | { kind: "customer"; data: CustomerHit };

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // flat list of hits in render order, for keyboard nav
  const flat: FlatHit[] = [
    ...products.map((p) => ({ kind: "product" as const, data: p })),
    ...customers.map((c) => ({ kind: "customer" as const, data: c })),
  ];

  // debounced fetch
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term)}&limit=5`,
          { signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          products: ProductHit[];
          customers: CustomerHit[];
        };
        setProducts(data.products);
        setCustomers(data.customers);
        setActive(0);
      } catch {
        // aborted or network — ignore
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  // close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // global hotkey: "/" focuses search (skips when typing in another input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function navigate(hit: FlatHit) {
    setOpen(false);
    setQuery("");
    setProducts([]);
    setCustomers([]);
    setLoading(false);
    if (hit.kind === "product") {
      router.push(`/dashboard/products?q=${encodeURIComponent(hit.data.sku)}`);
    } else {
      router.push(`/dashboard/customers/${hit.data.id}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (flat[active]) {
        e.preventDefault();
        navigate(flat[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && query.trim().length > 0;
  const empty =
    !loading && products.length === 0 && customers.length === 0;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search..."
        className="h-10 pl-9 pr-9 bg-card border-transparent shadow-sm focus-visible:border-ring text-sm"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (!next.trim()) {
            setProducts([]);
            setCustomers([]);
            setLoading(false);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-xl border bg-card shadow-lg overflow-hidden max-h-[28rem] overflow-y-auto">
          {empty ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No matches.
            </p>
          ) : (
            <>
              {products.length > 0 && (
                <Group label="Products" icon={Package}>
                  {products.map((p, idx) => (
                    <Hit
                      key={`p-${p.id}`}
                      isActive={active === idx}
                      onSelect={() => navigate({ kind: "product", data: p })}
                      onMouseEnter={() => setActive(idx)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ""}
                        </div>
                      </div>
                      <span className="text-sm font-medium shrink-0">
                        {formatINR(p.sellingPrice)}
                      </span>
                    </Hit>
                  ))}
                </Group>
              )}

              {customers.length > 0 && (
                <Group label="Customers" icon={User}>
                  {customers.map((c, idx) => {
                    const flatIdx = products.length + idx;
                    return (
                      <Hit
                        key={`c-${c.id}`}
                        isActive={active === flatIdx}
                        onSelect={() => navigate({ kind: "customer", data: c })}
                        onMouseEnter={() => setActive(flatIdx)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {c.phone}
                          </div>
                        </div>
                        {c.creditBalance > 0 && (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
                            Due {formatINR(c.creditBalance)}
                          </span>
                        )}
                      </Hit>
                    );
                  })}
                </Group>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Package;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <ul className="pb-1">{children}</ul>
    </div>
  );
}

function Hit({
  isActive,
  onSelect,
  onMouseEnter,
  children,
}: {
  isActive: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        // mousedown fires before input blur, so the click lands before the dropdown closes
        onMouseDown={(e) => {
          e.preventDefault();
          onSelect();
        }}
        onMouseEnter={onMouseEnter}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
          isActive ? "bg-muted/70" : "hover:bg-muted/50"
        }`}
      >
        {children}
      </button>
    </li>
  );
}
