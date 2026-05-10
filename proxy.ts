import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password"]);
const PROTECTED_PREFIXES = ["/dashboard"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
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

  if (isPublic(pathname) && session?.userId && pathname !== "/") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
