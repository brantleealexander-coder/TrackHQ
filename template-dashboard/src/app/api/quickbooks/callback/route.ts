import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const savedState = request.cookies.get("qb_oauth_state")?.value;

  // Validate state
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/accounting?error=invalid_state", request.url));
  }

  if (!code || !realmId) {
    return NextResponse.redirect(new URL("/accounting?error=missing_params", request.url));
  }

  // Exchange code for tokens
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch(
    "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QB_REDIRECT_URI!,
      }),
    }
  );

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/accounting?error=token_exchange_failed", request.url)
    );
  }

  const body = await tokenRes.json();
  const expiresAt = new Date(Date.now() + body.expires_in * 1000).toISOString();

  // Upsert tokens (single row, id=1)
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("qb_tokens").upsert({
    id: 1,
    realm_id: realmId,
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/accounting?error=save_failed", request.url)
    );
  }

  const response = NextResponse.redirect(
    new URL("/accounting?connected=true", request.url)
  );
  response.cookies.delete("qb_oauth_state");
  return response;
}
