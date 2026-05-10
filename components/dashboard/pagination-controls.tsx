"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationControls({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function go(p: number) {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-sm text-muted-foreground">
      <span>
        Showing <strong className="text-foreground">{from}</strong>–
        <strong className="text-foreground">{to}</strong> of{" "}
        <strong className="text-foreground">{total}</strong>
      </span>
      <div className="flex gap-1">
        <Button
          size="icon-sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="inline-flex items-center px-2 text-xs">
          Page {page} of {totalPages}
        </span>
        <Button
          size="icon-sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
