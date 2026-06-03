import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const description = (form.get("description") as string | null)?.trim() ?? "";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 20MB" }, { status: 413 });
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type ${file.type}` },
      { status: 415 }
    );
  }

  const finalName = name || file.name || "Untitled document";

  try {
    const uploaded = await uploadDocument(file);
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("documents")
      .insert({
        name: finalName,
        description: description || null,
        storage_path: uploaded.storage_path,
        mime_type: uploaded.mime_type,
        size_bytes: uploaded.size_bytes,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[documents] insert failed:", error?.message);
      return NextResponse.json({ error: "Could not save document" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, document_id: data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[documents] upload failed:", message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
