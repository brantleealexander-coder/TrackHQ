"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DocumentRowActions({ documentId }: { documentId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Delete this document? Attachments to existing orders will be removed too.")) return;
    setBusy(true);
    try {
      await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/api/documents/${documentId}/download`}
        target="_blank"
        rel="noreferrer"
        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Download
      </a>
      <button
        onClick={onDelete}
        disabled={busy}
        className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
