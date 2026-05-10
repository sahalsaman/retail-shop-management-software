"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Building2, Receipt, Users, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "profile", label: "Shop profile", icon: Building2 },
  { key: "tax", label: "Tax & GST", icon: Receipt },
  { key: "printer", label: "Receipt printer", icon: Printer },
  { key: "employees", label: "Employees", icon: Users },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("section") ?? "profile";

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const isActive = active === it.key;
        const next = new URLSearchParams(params.toString());
        next.set("section", it.key);
        return (
          <Link
            key={it.key}
            href={`${pathname}?${next.toString()}`}
            className={cn(
              "inline-flex items-center gap-2 px-3 h-9 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
