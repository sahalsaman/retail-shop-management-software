import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

// GET-able cookie clearer used by lib/dal.ts when a valid session cookie has
// no matching local user (cookie predates SQLite cache, secret was rotated,
// or the DB was wiped). Server components can't mutate cookies — route
// handlers can — so DAL redirects here instead of calling deleteSession()
// directly during render.
export async function GET(req: Request) {
  await deleteSession();
  const url = new URL("/login", req.url);
  return NextResponse.redirect(url);
}
