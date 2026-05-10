"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function InventoryToolbar() {
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

  function setView(view: "all" | "low") {
    const next = new URLSearchParams(params.toString());
    if (view === "low") next.set("view", "low");
    else next.delete("view");
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const view = params.get("view") === "low" ? "low" : "all";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="h-10 pl-9"
          placeholder="Search products in this branch…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="inline-flex rounded-lg border bg-muted p-0.5">
        <button
          type="button"
          onClick={() => setView("all")}
          className={`px-3 h-9 rounded-md text-sm font-medium ${
            view === "all" ? "bg-card shadow-sm" : "text-muted-foreground"
          }`}
        >
          All stock
        </button>
        <button
          type="button"
          onClick={() => setView("low")}
          className={`px-3 h-9 rounded-md text-sm font-medium ${
            view === "low" ? "bg-card shadow-sm" : "text-muted-foreground"
          }`}
        >
          Low stock only
        </button>
      </div>
    </div>
  );
}
