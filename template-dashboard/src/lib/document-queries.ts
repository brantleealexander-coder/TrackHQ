import { createServerSupabaseClient } from "./supabase";

export interface DocumentRow {
  id: number;
  name: string;
  description: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string;
}

export async function listDocuments(): Promise<DocumentRow[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, description, storage_path, mime_type, size_bytes, uploaded_at, uploaded_by")
    .order("uploaded_at", { ascending: false });
  if (error || !data) return [];
  return data as DocumentRow[];
}

export async function getDocument(id: number): Promise<DocumentRow | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("documents")
    .select("id, name, description, storage_path, mime_type, size_bytes, uploaded_at, uploaded_by")
    .eq("id", id)
    .maybeSingle();
  return (data as DocumentRow | null) ?? null;
}

export interface OrderAttachment {
  attachment_id: number;
  document_id: number;
  document_name: string;
  mime_type: string;
  size_bytes: number;
  attached_at: string;
}

export async function listOrderAttachments(orderId: number): Promise<OrderAttachment[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("order_attachments")
    .select(`
      id, document_id, attached_at,
      documents ( name, mime_type, size_bytes )
    `)
    .eq("order_id", orderId)
    .order("attached_at", { ascending: false });
  if (error || !data) return [];

  return (data as unknown as Array<{
    id: number;
    document_id: number;
    attached_at: string;
    documents: { name: string; mime_type: string; size_bytes: number } | null;
  }>).map((r) => ({
    attachment_id: r.id,
    document_id: r.document_id,
    document_name: r.documents?.name ?? "(unknown)",
    mime_type: r.documents?.mime_type ?? "application/octet-stream",
    size_bytes: r.documents?.size_bytes ?? 0,
    attached_at: r.attached_at,
  }));
}
