import type { Role } from "@/lib/types";

export const DASHBOARD_PAGE_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", exact: true },
  { key: "pos", label: "POS Billing", href: "/dashboard/pos" },
  { key: "products", label: "Products", href: "/dashboard/products" },
  { key: "inventory", label: "Inventory", href: "/dashboard/inventory" },
  { key: "customers", label: "Customers", href: "/dashboard/customers" },
  { key: "invoices", label: "Invoices", href: "/dashboard/invoices" },
  { key: "suppliers", label: "Suppliers", href: "/dashboard/suppliers" },
  { key: "purchases", label: "Purchases", href: "/dashboard/purchases" },
  { key: "expenses", label: "Expenses", href: "/dashboard/expenses" },
  { key: "reports", label: "Reports", href: "/dashboard/reports" },
  { key: "branches", label: "Branches", href: "/dashboard/branches" },
  { key: "settings", label: "Settings", href: "/dashboard/settings" },
] as const;

export type DashboardPagePermission =
  (typeof DASHBOARD_PAGE_PERMISSIONS)[number]["key"];

export const ALL_DASHBOARD_PAGE_PERMISSIONS = DASHBOARD_PAGE_PERMISSIONS.map(
  (p) => p.key,
);

export const DEFAULT_ROLE_PAGE_ACCESS: Record<Role, DashboardPagePermission[]> = {
  ADMIN: [...ALL_DASHBOARD_PAGE_PERMISSIONS],
  OWNER: [...ALL_DASHBOARD_PAGE_PERMISSIONS],
  MANAGER: [
    "dashboard",
    "pos",
    "products",
    "inventory",
    "customers",
    "invoices",
    "suppliers",
    "purchases",
    "expenses",
    "reports",
  ],
  CASHIER: ["dashboard", "pos", "customers", "invoices"],
  SALES_EXECUTIVE: ["dashboard", "pos", "products", "customers", "invoices"],
};

export function normalizePageAccess(
  role: Role,
  pageAccess?: readonly string[] | null,
): DashboardPagePermission[] {
  if (role === "ADMIN" || role === "OWNER") {
    return [...ALL_DASHBOARD_PAGE_PERMISSIONS];
  }
  const allowed = new Set(ALL_DASHBOARD_PAGE_PERMISSIONS);
  const explicit = (pageAccess ?? []).filter(
    (p): p is DashboardPagePermission => allowed.has(p as DashboardPagePermission),
  );
  return explicit.length ? explicit : [...DEFAULT_ROLE_PAGE_ACCESS[role]];
}

export function hasDashboardPageAccess(
  role: Role,
  pageAccess: readonly string[] | null | undefined,
  pathname: string,
) {
  if (role === "ADMIN" || role === "OWNER") return true;
  if (pathname === "/dashboard/profile" || pathname.startsWith("/dashboard/profile/")) {
    return true;
  }
  const match = DASHBOARD_PAGE_PERMISSIONS
    .filter((p) =>
      "exact" in p && p.exact
        ? pathname === p.href
        : pathname === p.href || pathname.startsWith(`${p.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return true;
  return normalizePageAccess(role, pageAccess).includes(match.key);
}

export function firstAllowedDashboardHref(
  role: Role,
  pageAccess?: readonly string[] | null,
) {
  const allowed = normalizePageAccess(role, pageAccess);
  return (
    DASHBOARD_PAGE_PERMISSIONS.find((p) => allowed.includes(p.key))?.href ??
    "/dashboard/profile"
  );
}
