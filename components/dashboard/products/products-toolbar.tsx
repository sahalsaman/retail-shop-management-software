"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CategoryListItem } from "@/lib/queries/categories";
import type { BrandListItem } from "@/lib/queries/brands";

export function ProductsToolbar({
  categories,
  brands,
}: {
  categories: CategoryListItem[];
  brands: BrandListItem[];
}) {
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
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="h-10 pl-9"
          placeholder="Search by name, SKU, barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Select
        className="h-10 w-44"
        value={params.get("category") ?? ""}
        onChange={(e) => setParam("category", e.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        className="h-10 w-44"
        value={params.get("brand") ?? ""}
        onChange={(e) => setParam("brand", e.target.value)}
      >
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
      <Select
        className="h-10 w-32"
        value={params.get("status") ?? "active"}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All</option>
      </Select>
    </div>
  );
}
