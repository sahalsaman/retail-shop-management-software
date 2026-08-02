"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePageAccess, type DashboardPagePermission } from "@/lib/permissions";
import type { Role } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: DashboardPagePermission;
  exact?: boolean;
};

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, permission: "dashboard", exact: true },
  { href: "/dashboard/pos", label: "POS Billing", icon: ShoppingCart, permission: "pos" },
  { href: "/dashboard/products", label: "Products", icon: Package, permission: "products" },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, permission: "inventory" },
  { href: "/dashboard/customers", label: "Customers", icon: Users, permission: "customers" },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText, permission: "invoices" },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck, permission: "suppliers" },
  { href: "/dashboard/purchases", label: "Purchases", icon: Receipt, permission: "purchases" },
  { href: "/dashboard/expenses", label: "Expenses", icon: Wallet, permission: "expenses" },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, permission: "reports" },
  { href: "/dashboard/branches", label: "Branches", icon: Building2, permission: "branches" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, permission: "settings" },
];

export function SidebarNav({
  role,
  pageAccess,
}: {
  role: Role;
  pageAccess: string[];
}) {
  const pathname = usePathname();
  const allowed = normalizePageAccess(role, pageAccess);
  return (
    <nav className="flex flex-col gap-0.5 px-2 py-2">
      {DASHBOARD_NAV_ITEMS.filter((item) => allowed.includes(item.permission)).map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
