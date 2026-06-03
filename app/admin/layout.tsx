import Link from "next/link";
import { ShieldCheck, Store, Mail, LayoutDashboard } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["ADMIN"]);

  return (
    <div className="min-h-screen flex gap-3 bg-background text-foreground">
      <aside className="hidden lg:flex sticky top-0 self-start h-dvh w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-gray-800 text-primary-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">Admin Console</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1 text-sm">
          <AdminNavLink href="/admin" exact icon={<LayoutDashboard className="h-4 w-4" />}>
            Overview
          </AdminNavLink>
          <AdminNavLink href="/admin/shops" icon={<Store className="h-4 w-4" />}>
            Shops
          </AdminNavLink>
          <AdminNavLink href="/admin/invites" icon={<Mail className="h-4 w-4" />}>
            Invites
          </AdminNavLink>
        </nav>
        <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/60">
          Retailo · Admin
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 gap-3 p-3">
        <header className="sticky top-3 z-30 h-16 rounded-2xl border bg-muted text-foreground flex items-center justify-between px-3 sm:px-4 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="lg:hidden text-sm font-medium">Admin</span>
          </div>
          <AdminUserMenu name={user.name} email={user.email} />
        </header>
        <main className="flex-1 rounded-2xl border bg-card text-card-foreground shadow-sm p-5 sm:p-7 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminNavLink({
  href,
  exact,
  icon,
  children,
}: {
  href: string;
  exact?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  // The active highlight is purely visual — keep this server-rendered for now.
  // Sidebar is short enough that an extra client component isn't worth it.
  void exact;
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
