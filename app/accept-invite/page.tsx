import { getInviteByToken } from "@/lib/queries/admin";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AcceptInvitePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const invite = token ? await getInviteByToken(token) : null;

  return (
    <main className="min-h-screen grid place-items-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        {!invite ? (
          <FailState title="Invite not found" message="The link is invalid or has been deleted." />
        ) : invite.status === "ACCEPTED" ? (
          <FailState title="Already accepted" message="This invite has already been used to onboard a shop." />
        ) : invite.status === "REVOKED" ? (
          <FailState title="Invite revoked" message="The admin has revoked this invite. Please request a new one." />
        ) : invite.status === "EXPIRED" || invite.expiresAt.getTime() < Date.now() ? (
          <FailState title="Invite expired" message="This invite is past its expiry date. Please ask for a new one." />
        ) : (
          <AcceptInviteForm
            token={token}
            email={invite.email}
            ownerName={invite.ownerName}
            shopName={invite.shopName}
            shopType={invite.shopType}
          />
        )}
      </div>
    </main>
  );
}

function FailState({ title, message }: { title: string; message: string }) {
  return (
    <div className="text-center space-y-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <a href="/login" className="inline-block mt-4 text-sm text-primary underline">
        Go to sign in
      </a>
    </div>
  );
}
