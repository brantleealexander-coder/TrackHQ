/**
 * /api/leads — submissions from the marketing /demo and /contact forms.
 *
 * Phase 7g: writes to the leads table (visible in /super-admin/leads) and
 * fires a Resend notification email to brantlee@talloakai.com. Email
 * sending is best-effort — if Resend is misconfigured we still return 200
 * to the front-end and surface the lead in the super-admin inbox.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { sendLeadNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

interface LeadPayload {
  kind: "demo" | "contact";
  name: string;
  email: string;
  phone?: string;
  business_name: string;
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
  const { lead } = result;

  // 1. Persist to the leads table so it appears in /super-admin/leads.
  // Best-effort: if the table is unreachable we still try to email.
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("leads").insert({
      kind: lead.kind,
      name: lead.name,
      email: lead.email,
      phone: lead.phone ?? null,
      business_name: lead.business_name,
      rental_type: lead.rental_type ?? null,
      current_software: lead.current_software ?? null,
      message: lead.message ?? null,
    });
    if (error) {
      console.error("[leads] insert failed:", error.message);
    }
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[leads] supabase client failed:", m);
  }

  // 2. Fire-and-forget notification email. Errors logged but not surfaced.
  try {
    await sendLeadNotification(lead);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[leads] email send failed:", m);
  }

  // 3. Operator still sees the lead in Vercel logs as a backup.
  console.log(
    `[trackhq-lead] ${new Date().toISOString()} ${lead.kind.toUpperCase()}`,
    JSON.stringify(lead)
  );

  return NextResponse.json({ ok: true });
}
