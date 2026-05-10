"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { BranchListItem } from "@/lib/queries/branches";

export function InvoicesToolbar({ branches }: { branches: BranchListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("q", search);
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5 flex-1 min-w-56">
        <Label className="text-xs text-muted-foreground">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-10 pl-9"
            placeholder="Bill #, customer name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          className="h-10 w-36"
          value={params.get("status") ?? "COMPLETED"}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="COMPLETED">Completed</option>
          <option value="HELD">Held</option>
          <option value="RETURNED">Returned</option>
          <option value="VOID">Void</option>
          <option value="all">All</option>
        </Select>
      </div>
      {branches.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Branch</Label>
          <Select
            className="h-10 w-44"
            value={params.get("branch") ?? "all"}
            onChange={(e) => setParam("branch", e.target.value)}
          >
            <option value="all">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Payment</Label>
        <Select
          className="h-10 w-32"
          value={params.get("method") ?? "all"}
          onChange={(e) => setParam("method", e.target.value)}
        >
          <option value="all">All methods</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
          <option value="CREDIT">Credit</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Outstanding</Label>
        <Select
          className="h-10 w-32"
          value={params.get("due") ?? "all"}
          onChange={(e) => setParam("due", e.target.value)}
        >
          <option value="all">Any</option>
          <option value="yes">With dues</option>
          <option value="no">Settled</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          className="h-10 w-40"
          type="date"
          value={params.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          className="h-10 w-40"
          type="date"
          value={params.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
        />
      </div>
    </div>
  );
}
