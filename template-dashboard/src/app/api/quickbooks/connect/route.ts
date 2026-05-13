import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET() {
  const state = randomUUID();

  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID!,
    redirect_uri: process.env.QB_REDIRECT_URI!,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    state,
  });

  const authUrl = `https://appcenter.intuit.com/connect/oauth2?${params}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("qb_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
