import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { connectDB } from "@/lib/mongoose";
import { User } from "@/models";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { ProfileForm } from "@/components/dashboard/profile/profile-form";
import { ChangePasswordForm } from "@/components/dashboard/profile/change-password-form";
import { SignOutButton } from "@/components/dashboard/profile/sign-out-button";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user.shopId && user.role !== "ADMIN") redirect("/dashboard");

  await connectDB();
  const doc = await User.findById(user.id)
    .select("name email phone role lastLoginAt createdAt")
    .lean<{
      _id: Types.ObjectId;
      name: string;
      email: string;
      phone: string | null;
      role: string;
      lastLoginAt: Date | null;
      createdAt: Date;
    } | null>();
  if (!doc) redirect("/login");

  return (
    <div className="space-y-5 max-w-3xl">
      <header className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-base">{initials(doc.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{doc.name}</h1>
          <p className="text-sm text-muted-foreground">
            {doc.email} <span className="mx-1.5 text-border">·</span>
            <Badge variant="secondary">{doc.role}</Badge>
          </p>
        </div>
      </header>

      <section className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Personal info</h2>
          <p className="text-sm text-muted-foreground">
            Update your display name and contact number.
          </p>
        </div>
        <ProfileForm
          defaultName={doc.name}
          email={doc.email}
          defaultPhone={doc.phone ?? ""}
          role={doc.role}
        />
      </section>

      <section className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Change password</h2>
          <p className="text-sm text-muted-foreground">
            Last sign-in:{" "}
            {doc.lastLoginAt ? formatDateTime(doc.lastLoginAt) : "—"}.
          </p>
        </div>
        <ChangePasswordForm />
      </section>

      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sign out</h2>
          <p className="text-sm text-muted-foreground">
            End this session on this device. Held bills and unsaved drafts will be lost.
          </p>
        </div>
        <SignOutButton />
      </section>
    </div>
  );
}
