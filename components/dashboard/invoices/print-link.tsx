"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintLink({
  saleId,
  thermal,
  label = "Print",
}: {
  saleId: string;
  thermal: boolean;
  label?: string;
}) {
  const href = thermal
    ? `/dashboard/pos/thermal/${saleId}`
    : `/dashboard/pos/print/${saleId}`;
  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={
        <a href={href} target="_blank" rel="noopener noreferrer">
          {/* base-ui passes children through */}
        </a>
      }
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
