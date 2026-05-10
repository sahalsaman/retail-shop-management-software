"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { name: string; email: string; role: string };

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ name, email, role }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
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
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="hidden md:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{role}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col px-2 py-1.5 text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{email}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          nativeButton={false}
          render={<Link href="/dashboard/profile" />}
        >
          <UserIcon className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={logout}
          disabled={isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
