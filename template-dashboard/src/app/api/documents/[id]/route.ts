import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { deleteStoredFile } from "@/lib/storage";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { company_id } = await requireMembership();
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("company_id", company_id)
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteStoredFile((doc as { storage_path: string }).storage_path);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[documents] storage delete failed (continuing):", message);
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("company_id", company_id)
    .eq("id", id);
  if (error) {
    console.error("[documents] delete row failed:", error.message);
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
