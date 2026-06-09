import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["new", "contacted", "converted", "declined"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireSuperAdmin();
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createSupabaseServiceClient();
  const { error } = await admin.from("leads").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
