import { Store } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { HeaderSearch } from "@/components/dashboard/header-search";
import { BottomNavigation } from "@/components/dashboard/bottom-navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // JWT-only — no DB round-trip on the layout so navigation stays instant even
  // when the cloud is slow/unreachable. The shop name rides in the session token.
  const user = await getCurrentUser();
  const shopName = user.shopName?.trim() || "Your Shop";

  return (
    <div className="min-h-dvh flex gap-3 bg-background text-foreground">
      <aside className="hidden lg:flex sticky top-0 self-start h-dvh w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-gray-800 text-primary-foreground shadow-sm">
            <Store className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight truncate">{shopName}</span>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav role={user.role} pageAccess={user.pageAccess} />
        </div>
        <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/60">
          RETAILO · v0.1
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 gap-2 sm:gap-3 p-0 sm:p-3 pb-20 lg:pb-3">
        <header className="sticky top-0 sm:top-3 z-30 h-14 sm:h-16 rounded-none sm:rounded-2xl border-b sm:border bg-muted text-foreground flex items-center justify-between px-2.5 sm:px-4 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MobileSidebar
              shopName={shopName}
              role={user.role}
              pageAccess={user.pageAccess}
            />
            <HeaderSearch />
          </div>
          <UserMenu name={user.name} email={user.email} role={user.role} />
        </header>
        <main className="flex-1 rounded-none sm:rounded-2xl border-0 sm:border bg-card text-card-foreground shadow-sm p-3 sm:p-7 lg:p-8 overflow-y-auto">
          {children}
        </main>
        <BottomNavigation
          shopName={shopName}
          role={user.role}
          pageAccess={user.pageAccess}
        />
      </div>
    </div>
  );
}
