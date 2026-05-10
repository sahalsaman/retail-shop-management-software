"use client";

import { useState } from "react";
import { Menu, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

export function MobileSidebar({ shopName }: { shopName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        }
      />
      <SheetContent
        side="left"
        className="p-0 w-64 bg-sidebar text-sidebar-foreground border-sidebar-border"
      >
        <SheetHeader className="border-b border-sidebar-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2.5 text-sidebar-foreground">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </span>
            <span className="truncate">{shopName}</span>
          </SheetTitle>
        </SheetHeader>
        <div onClick={() => setOpen(false)}>
          <SidebarNav />
        </div>
      </SheetContent>
    </Sheet>
  );
}
