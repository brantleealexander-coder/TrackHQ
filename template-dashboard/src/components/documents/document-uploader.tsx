"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DocumentUploaderProps {
  // Optional: when set, the upload also POSTs an attachment row linking the
  // new document to this order. Used from the order detail page.
  attachToOrderId?: number;
}

export default function DocumentUploader({ attachToOrderId }: DocumentUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) {
      setError("Pick a file first.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (name.trim()) form.append("name", name.trim());
      if (description.trim()) form.append("description", description.trim());

      const res = await fetch("/api/documents", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Upload failed.");
        return;
      }

      if (attachToOrderId && json.document_id) {
        await fetch(`/api/orders/${attachToOrderId}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: json.document_id }),
        });
      }

      setFile(null);
      setName("");
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50/40 p-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          File (PDF, DOCX, PNG, JPG · max 20MB)
        </label>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-gray-800"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={file?.name ?? "Document name"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Description (optional)</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this for?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={uploading || !file}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : attachToOrderId ? "Upload & attach" : "Upload"}
        </button>
        <span className="text-xs text-gray-400">
          {file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : "No file selected"}
        </span>
      </div>
    </div>
  );
}
