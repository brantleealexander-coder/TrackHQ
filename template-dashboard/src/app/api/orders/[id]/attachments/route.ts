import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { company_id } = await requireMembership();
  const orderId = parseInt(params.id, 10);
  if (Number.isNaN(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Bad order id" }, { status: 400 });
  }

  let body: { document_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const documentId = typeof body.document_id === "number" ? body.document_id : 0;
  if (!documentId) {
    return NextResponse.json({ error: "document_id required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  // Verify both order and document belong to this company before linking.
  const [orderCheck, docCheck] = await Promise.all([
    supabase.from("orders").select("id").eq("company_id", company_id).eq("id", orderId).maybeSingle(),
    supabase.from("documents").select("id").eq("company_id", company_id).eq("id", documentId).maybeSingle(),
  ]);
  if (!orderCheck.data || !docCheck.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("order_attachments")
    .insert({ company_id, order_id: orderId, document_id: documentId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already_attached: true });
    }
    console.error("[order-attachments] insert failed:", error.message);
    return NextResponse.json({ error: "Could not attach document" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { company_id } = await requireMembership();
  const orderId = parseInt(params.id, 10);
  if (Number.isNaN(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Bad order id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const attachmentId = parseInt(url.searchParams.get("attachment_id") ?? "", 10);
  if (Number.isNaN(attachmentId) || attachmentId <= 0) {
    return NextResponse.json({ error: "attachment_id required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("order_attachments")
    .delete()
    .eq("company_id", company_id)
    .eq("id", attachmentId)
    .eq("order_id", orderId);

  if (error) {
    return NextResponse.json({ error: "Could not detach" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
