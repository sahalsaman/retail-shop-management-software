import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { setMeta } from "@/lib/sqlite";
import { isDesktop } from "@/lib/runtime";

export async function POST() {
  // Pause sync. Data tables stay so the next login (same shop) is fast.
  // Desktop only — the web build has no local SQLite store.
  if (isDesktop()) {
    setMeta("active_user_id", null);
    setMeta("active_shop_id", null);
  }

  // Clear the session cookie directly on the response. Setting an already-
  // expired cookie with the SAME attributes it was created with (path, secure,
  // sameSite, httpOnly) is the reliable way to evict it across browsers — more
  // dependable than cookies().delete() from a route handler. If this is missed,
  // the proxy still sees a valid session and bounces /login back to /dashboard,
  // which looks like "sign out doesn't work".
  const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    maxAge: 0,
    path: "/",
  });
  return res;
}
