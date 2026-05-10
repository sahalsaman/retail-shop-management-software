import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[] | undefined>;
    const first = Object.values(fieldErrors)[0]?.[0] ?? "Invalid input";
    return fail(first, 400, { fieldErrors });
  }
  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return fail("Duplicate entry", 409);
  }
  console.error(err);
  return fail("Server error", 500);
}
