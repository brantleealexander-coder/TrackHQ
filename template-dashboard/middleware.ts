import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "crossmar_auth";

function makeToken(secret: string): string {
  return createHmac("sha256", secret).update("authenticated").digest("hex");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never block login page or auth API route
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth") || pathname === "/privacy" || pathname === "/terms") {
    return NextResponse.next();
  }

  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    // Misconfigured — redirect to login so we don't silently expose data
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
