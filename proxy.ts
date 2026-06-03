import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password"]);
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

function isPublic(pathname: string) {
  // /accept-invite is also public; it sits outside PUBLIC_PATHS because it
  // shouldn't bounce logged-in users away — they may need to accept an invite
  // on behalf of someone else.
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/accept-invite");
}

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(token);

  if (isProtected(pathname) && !session?.userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Keep admins out of /dashboard (queries assume a shop) and shop users out
  // of /admin (UI is for platform operators only).
  if (session?.userId) {
    if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    if (pathname.startsWith("/dashboard") && session.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", req.nextUrl));
    }
  }

  // Logged-in user on a public auth page → send them to their landing.
  if (
    PUBLIC_PATHS.has(pathname) &&
    session?.userId &&
    pathname !== "/" &&
    !pathname.startsWith("/accept-invite")
  ) {
    const landing = session.role === "ADMIN" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(landing, req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
