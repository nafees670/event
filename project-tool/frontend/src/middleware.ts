import { NextResponse, type NextRequest } from "next/server";

/** Pages reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/invite"];

// Set by Django alongside the httpOnly JWT cookies and expires with the session
// (SESSION_MAX_HOURS). The API itself still validates every request; this only
// keeps signed-out visitors away from app pages.
const SESSION_COOKIE = "pm_session";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API/backend routes, Next internals and static files.
  matcher: ["/((?!api|admin|media|static|ws|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
