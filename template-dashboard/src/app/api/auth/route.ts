import { NextResponse } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "crossmar_auth";

function makeToken(secret: string): string {
  return createHmac("sha256", secret).update("authenticated").digest("hex");
}

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.COOKIE_SECRET!;
  const token = makeToken(secret);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
