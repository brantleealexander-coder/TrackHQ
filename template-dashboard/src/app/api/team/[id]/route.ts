import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const remover = await requireRole(["owner"]);
  const membershipId = parseInt(params.id, 10);
  if (Number.isNaN(membershipId) || membershipId <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const admin = createSupabaseServiceClient();

  const { data: target } = await admin
    .from("memberships")
    .select("id, user_id, role, company_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!target || target.company_id !== remover.company_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.user_id === remover.user_id) {
    return NextResponse.json({ error: "Can't remove yourself" }, { status: 400 });
  }

  if (target.role === "owner") {
    const { data: owners } = await admin
      .from("memberships")
      .select("id")
      .eq("company_id", remover.company_id)
      .eq("role", "owner");
    if ((owners?.length ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Can't remove the only owner." },
        { status: 400 }
      );
    }
  }

  const { error } = await admin.from("memberships").delete().eq("id", membershipId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
