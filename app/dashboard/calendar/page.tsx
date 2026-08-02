import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueCalendar } from "@/components/dashboard/revenue-calendar";
import { getCurrentUser } from "@/lib/dal";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { listBranches } from "@/lib/queries/branches";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();

  if (!user.shopId) {
    return (
      <div className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>No shop linked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Your account isn&apos;t linked to a shop yet. Contact support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const [summary, branches] = await Promise.all([
    getDashboardSummary(user.shopId, month),
    listBranches(user.shopId),
  ]);
  const canEdit = user.role === "OWNER" || user.role === "ADMIN";

  return (
   

      <RevenueCalendar
        monthKey={summary.calendar.monthKey}
        average={summary.calendar.average}
        days={summary.calendar.days}
        canEdit={canEdit}
        branches={branches}
      />
  );
}
