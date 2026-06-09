import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[A-Fa-f0-9]{6}$/;

export async function POST(req: NextRequest) {
  await requireSuperAdmin();

  let body: {
    name?: unknown;
    slug?: unknown;
    brand_color?: unknown;
    owner_email?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const brand = typeof body.brand_color === "string" ? body.brand_color.trim() : "";
  const email = typeof body.owner_email === "string" ? body.owner_email.trim().toLowerCase() : "";

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "slug must be lowercase a-z, 0-9, hyphens" }, { status: 400 });
  if (!HEX_RE.test(brand)) return NextResponse.json({ error: "brand_color must be #RRGGBB" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "valid owner_email required" }, { status: 400 });

  const admin = createSupabaseServiceClient();
  const origin = req.nextUrl.origin;

  // Insert the company row.
  const { data: company, error: companyErr } = await admin
    .from("companies")
    .insert({ name, slug, brand_color: brand })
    .select("id")
    .single();
  if (companyErr || !company) {
    if (companyErr?.code === "23505") {
      return NextResponse.json({ error: `slug "${slug}" is already taken.` }, { status: 409 });
    }
    return NextResponse.json(
      { error: companyErr?.message ?? "could not create company" },
      { status: 500 }
    );
  }

  // Resolve or invite the owner user.
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId = existing?.users.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
  let inviteSent = false;

  if (!userId) {
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { company_id: company.id, invited_role: "owner" },
      redirectTo: `${origin}/auth/callback?next=/accept-invite`,
    });
    if (inviteErr || !invited?.user) {
      // Roll back the company so the slug isn't wasted on a half-built record.
      await admin.from("companies").delete().eq("id", company.id);
      return NextResponse.json(
        { error: inviteErr?.message ?? "could not invite owner" },
        { status: 500 }
      );
    }
    userId = invited.user.id;
    inviteSent = true;
  }

  const { error: membershipErr } = await admin.from("memberships").insert({
    user_id: userId,
    company_id: company.id,
    role: "owner",
  });
  if (membershipErr) {
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json(
      { error: `could not create owner membership: ${membershipErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    company_id: company.id,
    owner_user_id: userId,
    invite_sent: inviteSent,
  });
}
