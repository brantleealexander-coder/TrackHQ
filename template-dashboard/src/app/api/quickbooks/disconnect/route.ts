import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getQBTokens } from "@/lib/quickbooks";

export async function POST() {
  const supabase = createServerSupabaseClient();

  // Best-effort revoke with Intuit
  const tokens = await getQBTokens();
  if (tokens) {
    const credentials = Buffer.from(
      `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
    ).toString("base64");

    try {
      await fetch("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({ token: tokens.refresh_token }),
      });
    } catch {
      // Ignore revocation errors
    }
  }

  // Delete tokens and cache
  await supabase.from("qb_tokens").delete().eq("id", 1);
  await supabase.from("qb_cache").delete().neq("cache_key", "");

  return NextResponse.json({ ok: true });
}
