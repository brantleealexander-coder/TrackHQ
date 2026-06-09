import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getSignedDownloadUrl } from "@/lib/storage";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { company_id } = await requireMembership();
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("company_id", company_id)
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl((data as { storage_path: string }).storage_path);
  if (!signedUrl) {
    return NextResponse.json({ error: "Could not generate URL" }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl, 302);
}
