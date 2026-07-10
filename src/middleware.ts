import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

/**
 * The whole app sits behind one gate. Pages redirect to /login; API routes
 * get a plain 401. The only public paths are the login surface itself and
 * the PWA plumbing (manifest, service worker, icons) the browser must fetch
 * before any session exists.
 */

const PUBLIC_PATHS = new Set(["/login", "/api/auth", "/manifest.webmanifest", "/sw.js"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/icons/")) {
    return NextResponse.next();
  }

  const ok = await verifyToken(req.cookies.get(COOKIE_NAME)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname === "/" ? "" : `?from=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next internals and static files with extensions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp)$).*)"],
};
