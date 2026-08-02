import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { Role } from "./types";

const SESSION_COOKIE = "rsms_session";
// Desktop sessions persist across reboots until explicit logout. 1 year cookie.
const SESSION_TTL_DAYS = 365;

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET is not set in .env");
}
const encodedKey = new TextEncoder().encode(secret);

export type SessionPayload = JWTPayload & {
  userId: string;
  shopId: string | null;
  branchId: string | null;
  role: Role;
  email: string;
  name: string;
  // Shop display name baked into the token so the dashboard shell never has to
  // hit the DB on every navigation. May be absent on tokens issued before this
  // field existed — callers fall back to a default.
  shopName?: string | null;
  pageAccess?: string[];
};

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(encodedKey);
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: Omit<SessionPayload, "iat" | "exp">) {
  const token = await encrypt(payload as SessionPayload);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return decrypt(token);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
