"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PendingBookingRequestRow } from "@/lib/booking-request-queries";

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sourceBadge(source: string): { label: string; cls: string } {
  if (source === "voice") return { label: "Voice", cls: "bg-purple-50 text-purple-700" };
  if (source === "web") return { label: "Web", cls: "bg-amber-50 text-amber-700" };
  return { label: source, cls: "bg-gray-100 text-gray-600" };
}

export default function PendingList({ rows }: { rows: PendingBookingRequestRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-base font-medium text-gray-700">No pending bookings.</p>
        <p className="mt-1 text-sm text-gray-500">
          Voice and web bookings appear here for review before they become confirmed orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <PendingCard key={r.id} row={r} />
      ))}
    </div>
  );
}

function PendingCard({ row }: { row: PendingBookingRequestRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const src = sourceBadge(row.source);

  async function approve() {
    setBusy("approve");
    setError(null);
    try {
      const res = await fetch(`/api/booking-requests/${row.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not approve.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(null);
    }
  }

  async function reject() {
    if (!confirm(`Reject this booking from ${row.customer_name}? This can't be undone.`)) return;
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/booking-requests/${row.id}/reject`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not reject.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200/70 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-gray-400">
              #{String(row.id).padStart(5, "0")}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${src.cls}`}>
              {src.label}
            </span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              Pending
            </span>
          </div>

          <div className="text-base font-semibold text-gray-900">
            {row.customer_name} <span className="text-gray-400">·</span>{" "}
            <span className="font-normal text-gray-700">{row.equipment_name}</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-gray-500">
            <span>
              {fmtDate(row.rental_start)} → {fmtDate(row.rental_end)}
            </span>
            {row.rate_type && (
              <span className="capitalize">{row.rate_type}</span>
            )}
            {row.customer_phone && <span>{row.customer_phone}</span>}
            {row.customer_email && <span>{row.customer_email}</span>}
          </div>

          {row.notes && (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {row.notes}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={reject}
            disabled={busy !== null}
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </button>
          <button
            onClick={approve}
            disabled={busy !== null}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
