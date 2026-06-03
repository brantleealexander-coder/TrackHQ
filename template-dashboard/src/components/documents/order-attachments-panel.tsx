"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentRow } from "@/lib/document-queries";
import type { OrderAttachment } from "@/lib/document-queries";

interface OrderAttachmentsPanelProps {
  orderId: number;
  attachments: OrderAttachment[];
  libraryDocuments: DocumentRow[];
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OrderAttachmentsPanel({
  orderId,
  attachments,
  libraryDocuments,
}: OrderAttachmentsPanelProps) {
  const router = useRouter();
  const [picker, setPicker] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachedIds = new Set(attachments.map((a) => a.document_id));
  const availableInLibrary = libraryDocuments.filter((d) => !attachedIds.has(d.id));

  async function attachFromLibrary() {
    if (!picker) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: picker }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not attach.");
        return;
      }
      setPicker("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function detach(attachmentId: number) {
    if (!confirm("Detach this document from the order?")) return;
    setBusy(true);
    try {
      await fetch(`/api/orders/${orderId}/attachments?attachment_id=${attachmentId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Attachments</h2>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600">
          {attachments.length}
        </span>
      </div>

      {/* Attached */}
      {attachments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-3 py-4 text-center text-xs text-gray-500">
          No documents attached yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {attachments.map((a) => (
            <li key={a.attachment_id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{a.document_name}</p>
                <p className="text-[11px] text-gray-500">{fmtBytes(a.size_bytes)}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <a
                  href={`/api/documents/${a.document_id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Download
                </a>
                <button
                  onClick={() => detach(a.attachment_id)}
                  disabled={busy}
                  className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Attach from library */}
      {availableInLibrary.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Attach from library
          </p>
          <div className="flex items-center gap-2">
            <select
              value={picker}
              onChange={(e) => setPicker(e.target.value ? Number(e.target.value) : "")}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Pick a document —</option>
              {availableInLibrary.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              onClick={attachFromLibrary}
              disabled={!picker || busy}
              className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Attach
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
