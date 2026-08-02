import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { firstAllowedDashboardHref, hasDashboardPageAccess } from "@/lib/permissions";
import type { Role } from "@/lib/types";

const SESSION_COOKIE = "rsms_session";

type ProxySession = {
  userId?: string;
  role?: Role;
  pageAccess?: string[];
};

async function readSession(req: NextRequest): Promise<ProxySession | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] },
    );
    return payload as ProxySession;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const session = await readSession(req);
  if (!session?.userId) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (
    session.role &&
    !hasDashboardPageAccess(session.role, session.pageAccess, req.nextUrl.pathname)
  ) {
    return NextResponse.redirect(
      new URL(firstAllowedDashboardHref(session.role, session.pageAccess), req.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
