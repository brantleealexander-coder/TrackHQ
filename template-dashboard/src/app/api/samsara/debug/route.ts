import { NextResponse } from "next/server";
import { isSamsaraConfigured } from "@/lib/samsara";

export const dynamic = "force-dynamic";

// Diagnostic endpoint — returns the first page of the raw Samsara
// /v1/fleet/assets/locations response so we can see the actual shape.
// Safe to call: read-only, behind the same auth gate as the rest of the app.
export async function GET() {
  if (!isSamsaraConfigured()) {
    return NextResponse.json({ error: "SAMSARA_API_TOKEN not set" }, { status: 400 });
  }

  const token = process.env.SAMSARA_API_TOKEN!;
  try {
    const res = await fetch("https://api.samsara.com/v1/fleet/assets/locations?limit=5", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      body: parsed,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
