import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate for the whole admin area, including routes added later: without a session cookie,
// admin pages redirect to the admin sign-in page and admin APIs answer 401. This only reads the cookie;
// lib/admin.ts verifies the session and profiles.is_superadmin on every admin page and Route Handler.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login" || getSessionCookie(request)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in with Google." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = { matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"] };
