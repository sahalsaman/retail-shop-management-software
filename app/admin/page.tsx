import Link from "next/link";
import { Store, Mail, Users, CheckCircle2 } from "lucide-react";
import { adminStats } from "@/lib/queries/admin";

export default async function AdminHome() {
  const stats = await adminStats();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Platform health and quick actions.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Total shops" value={stats.totalShops} icon={<Store className="h-4 w-4" />} />
        <Stat label="Active shops" value={stats.activeShops} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Owners" value={stats.totalOwners} icon={<Users className="h-4 w-4" />} />
        <Stat label="Pending invites" value={stats.pendingInvites} icon={<Mail className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border bg-muted/40 p-5">
        <h2 className="text-base font-medium">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/admin/invites"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium"
          >
            <Mail className="h-4 w-4" /> Invite a shop owner
          </Link>
          <Link
            href="/admin/shops"
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium"
          >
            <Store className="h-4 w-4" /> View all shops
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wide">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
