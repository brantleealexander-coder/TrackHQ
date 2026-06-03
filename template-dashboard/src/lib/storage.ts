import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "tenant-documents";

// Service-role storage client. Documents go to a private bucket; downloads
// are served via short-lived signed URLs from /api/documents/[id]/download.
function getStorageClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Storage client requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Best-effort bucket bootstrap: lazy-create the private bucket on first
// upload so dev forks don't have to set it up manually. Existing buckets
// return an error we ignore.
async function ensureBucket(client: SupabaseClient): Promise<void> {
  const { data: buckets } = await client.storage.listBuckets();
  if ((buckets ?? []).some((b) => b.name === BUCKET)) return;
  const { error } = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024, // 20MB
  });
  // Race-condition or "already exists" — fine.
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`createBucket: ${error.message}`);
  }
}

function safeBasename(name: string): string {
  // Strip path traversal, keep extension. Replace anything weird with _.
  return name.split(/[\\/]/).pop()?.replace(/[^A-Za-z0-9._-]+/g, "_") ?? "file";
}

function pseudoId(): string {
  // Sortable, collision-resistant enough for filenames.
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

export interface UploadResult {
  storage_path: string;
  size_bytes: number;
  mime_type: string;
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  const client = getStorageClient();
  await ensureBucket(client);

  const buf = Buffer.from(await file.arrayBuffer());
  const path = `library/${pseudoId()}-${safeBasename(file.name)}`;

  const { error } = await client.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`uploadDocument: ${error.message}`);

  return {
    storage_path: path,
    size_bytes: file.size,
    mime_type: file.type || "application/octet-stream",
  };
}

export async function getSignedDownloadUrl(
  storagePath: string,
  expiresSec = 60 * 60
): Promise<string | null> {
  const client = getStorageClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresSec);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deleteStoredFile(storagePath: string): Promise<void> {
  const client = getStorageClient();
  await client.storage.from(BUCKET).remove([storagePath]);
}
