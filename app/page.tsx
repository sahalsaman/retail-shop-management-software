import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";

export default async function Home() {
  const session = await getSessionFromCookies();
  if (!session?.userId) redirect("/login");
  redirect(session.role === "ADMIN" ? "/admin" : "/dashboard");
}
