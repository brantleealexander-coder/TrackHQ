import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "tenant_auth";

function makeToken(secret: string): string {
  return createHmac("sha256", secret).update("authenticated").digest("hex");
}

// Public paths — no auth cookie required. Everything not on this list
// (in particular `/app/*` and all data-touching `/api/*` routes) is gated.
// Marketing pages, the POS at `/book/<slug>`, the lead-capture API, and
// the legal pages are intentionally open.
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/privacy",
  "/terms",
  "/book",       // POS (Phase 5e)
  "/api/book",   // POS write API (Phase 5e)
  "/api/leads",  // demo-form lead capture (Phase 5b)
  "/pricing",
  "/about",
  "/contact",
  "/demo",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") return NextResponse.next();
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isPublic) {
    return NextResponse.next();
  }

  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const expected = makeToken(secret);
  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  if (cookie !== expected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
