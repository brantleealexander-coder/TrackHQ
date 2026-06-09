import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["owner", "admin", "member"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const inviter = await requireRole(["owner", "admin"]);

  let body: { email?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const roleRaw = typeof body.role === "string" ? body.role : "member";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!VALID_ROLES.has(roleRaw)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  // Only owners can mint new owners.
  if (roleRaw === "owner" && inviter.role !== "owner") {
    return NextResponse.json({ error: "Only owners can invite owners" }, { status: 403 });
  }

  const admin = createSupabaseServiceClient();
  const origin = req.nextUrl.origin;

  // If a user already exists with this email, attach a membership directly.
  // Otherwise send an invite link and create the membership when the invite
  // confirms (we attach by user_id immediately so the row is ready).
  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("company_id", inviter.company_id)
    .order("id");

  // Look up the auth user (admin.listUsers paginates — we just check by email).
  const { data: lookup } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId: string | null =
    lookup?.users.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;

  if (userId) {
    // User exists — check for an existing membership in this company.
    const { data: existingMembership } = await admin
      .from("memberships")
      .select("id, role")
      .eq("company_id", inviter.company_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingMembership) {
      return NextResponse.json(
        { error: `${email} is already on this team.` },
        { status: 409 }
      );
    }
  } else {
    // No user yet — send an invite email which creates the auth.users row.
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          company_id: inviter.company_id,
          invited_role: roleRaw,
        },
        redirectTo: `${origin}/auth/callback?next=/accept-invite`,
      }
    );
    if (inviteErr || !invited?.user) {
      console.error("[team/invite] inviteUserByEmail failed:", inviteErr?.message);
      return NextResponse.json(
        { error: inviteErr?.message ?? "Could not send invite." },
        { status: 500 }
      );
    }
    userId = invited.user.id;
  }

  const { error: membershipErr } = await admin.from("memberships").insert({
    user_id: userId,
    company_id: inviter.company_id,
    role: roleRaw,
    invited_by: inviter.user_id,
  });
  if (membershipErr) {
    console.error("[team/invite] membership insert failed:", membershipErr.message);
    return NextResponse.json({ error: "Could not record membership." }, { status: 500 });
  }

  // For existing users we don't trigger an email; only invite-by-email does that.
  // Surface that distinction to the caller so the UI can show the right copy.
  return NextResponse.json({
    ok: true,
    user_id: userId,
    invite_email_sent: !existing,
  });
}
