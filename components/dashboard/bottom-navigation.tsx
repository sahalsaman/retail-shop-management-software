"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Store } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizePageAccess } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { DASHBOARD_NAV_ITEMS, SidebarNav } from "./sidebar-nav";

const PRIMARY_KEYS = ["dashboard", "pos", "products", "invoices"] as const;

export function BottomNavigation({
  shopName,
  role,
  pageAccess,
}: {
  shopName: string;
  role: Role;
  pageAccess: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allowed = normalizePageAccess(role, pageAccess);

  const primaryItems = useMemo(() => {
    const preferred = DASHBOARD_NAV_ITEMS.filter(
      (item) =>
        allowed.includes(item.permission) &&
        PRIMARY_KEYS.includes(item.permission as (typeof PRIMARY_KEYS)[number]),
    );
    const fill = DASHBOARD_NAV_ITEMS.filter(
      (item) =>
        allowed.includes(item.permission) &&
        !preferred.some((p) => p.permission === item.permission),
    );
    return [...preferred, ...fill].slice(0, 4);
  }, [allowed]);

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 text-card-foreground shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="grid grid-cols-5 items-stretch px-1 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium leading-tight transition-colors",
                active
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.label.replace(" Billing", "")}</span>
            </Link>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className="flex min-h-14 h-auto flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium leading-tight text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                <Menu className="h-5 w-5" />
                <span>More</span>
              </Button>
            }
          />
          <SheetContent
            side="bottom"
            className="max-h-[78dvh] overflow-hidden rounded-t-2xl border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&_[data-slot=sheet-close]]:text-sidebar-foreground [&_[data-slot=sheet-close]]:hover:bg-sidebar-accent [&_[data-slot=sheet-close]]:hover:text-sidebar-accent-foreground"
          >
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex items-center gap-2.5 pr-8 text-sidebar-foreground">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Store className="h-4 w-4" />
                </span>
                <span className="truncate">{shopName}</span>
              </SheetTitle>
            </SheetHeader>
            <div
              className="max-h-[calc(78dvh-4rem)] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
              onClick={() => setOpen(false)}
            >
              <SidebarNav role={role} pageAccess={pageAccess} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
