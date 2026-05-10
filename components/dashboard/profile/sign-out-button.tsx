"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function logout() {
    if (!confirm("Sign out of this device?")) return;
    start(async () => {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        toast.error("Could not sign out");
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <Button variant="destructive" onClick={logout} disabled={pending}>
      <LogOut className="h-4 w-4" />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
