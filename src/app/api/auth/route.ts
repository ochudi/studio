import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, MAX_AGE_SECONDS, issueToken, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Login/logout. Tiny in-memory throttle: after 5 failed attempts from one IP,
 * a 30-second cooldown. Serverless instances don't share memory, which is
 * fine — this only needs to make dumb brute force boring, and the password
 * is a long passphrase anyway.
 */

const failures = new Map<string, { count: number; until: number }>();

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const f = failures.get(ip);
  if (f && f.count >= 5 && Date.now() < f.until) {
    return NextResponse.json({ error: "Too many attempts. Wait a moment." }, { status: 429 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    // fall through with empty password
  }

  if (!(await verifyPassword(password))) {
    const prev = failures.get(ip) ?? { count: 0, until: 0 };
    failures.set(ip, { count: prev.count + 1, until: Date.now() + 30_000 });
    return NextResponse.json({ error: "That's not it." }, { status: 401 });
  }

  failures.delete(ip);
  const token = await issueToken();
  if (!token) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
