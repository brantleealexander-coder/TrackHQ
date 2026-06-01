/**
 * /api/leads — accepts demo / contact form submissions from the marketing site.
 *
 * Phase 5b-3 minimum viable: validates the payload, logs it to the server
 * console (visible in Vercel logs), and returns 200. Phase 5e will wire
 * this up to the central registry Supabase (`leads` table) and an email
 * notification to sales — until then the operator can read the lead
 * out of Vercel logs.
 */

import { NextResponse, type NextRequest } from "next/server";

interface LeadPayload {
  kind: "demo" | "contact";
  name?: string;
  email?: string;
  phone?: string;
  business_name?: string;
  rental_type?: string;
  current_software?: string;
  message?: string;
}

function validate(body: unknown): { ok: true; lead: LeadPayload } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "body must be an object" };
  const b = body as Record<string, unknown>;
  if (b.kind !== "demo" && b.kind !== "contact") {
    return { ok: false, reason: "kind must be 'demo' or 'contact'" };
  }
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return { ok: false, reason: "name is required" };
  }
  if (typeof b.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
    return { ok: false, reason: "valid email is required" };
  }
  if (typeof b.business_name !== "string" || b.business_name.trim().length === 0) {
    return { ok: false, reason: "business_name is required" };
  }
  return {
    ok: true,
    lead: {
      kind: b.kind,
      name: String(b.name).trim(),
      email: String(b.email).trim(),
      phone: typeof b.phone === "string" ? b.phone.trim() : undefined,
      business_name: String(b.business_name).trim(),
      rental_type: typeof b.rental_type === "string" ? b.rental_type.trim() : undefined,
      current_software: typeof b.current_software === "string" ? b.current_software.trim() : undefined,
      message: typeof b.message === "string" ? b.message.trim() : undefined,
    },
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const result = validate(payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  // Phase 5e will replace this with: insert into trackhq-registry.leads
  // + send notification email to sales. For now: log so operators can
  // see the lead in Vercel function logs.
  console.log(
    `[trackhq-lead] ${new Date().toISOString()} ${result.lead.kind.toUpperCase()}`,
    JSON.stringify(result.lead)
  );

  return NextResponse.json({ ok: true });
}
