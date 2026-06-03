"use client";

import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminUserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="hidden sm:flex items-center gap-2 text-sm">
        <span className="grid place-items-center h-8 w-8 rounded-full bg-muted">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="leading-tight">
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{email}</div>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onLogout}>
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
