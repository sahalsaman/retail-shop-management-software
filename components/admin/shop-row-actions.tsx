"use client";

import { useTransition } from "react";
import { Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleShopActive } from "@/lib/actions/admin";

export function ShopRowActions({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={isActive ? "Deactivate shop" : "Reactivate shop"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleShopActive(id, !isActive);
          if (!res.ok) toast.error(res.error);
          else toast.success(isActive ? "Shop deactivated" : "Shop reactivated");
        })
      }
    >
      <Power className={`h-4 w-4 ${isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
    </Button>
  );
}
