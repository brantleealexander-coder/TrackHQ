"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/order-queries";

const NEXT_BY_STATUS: Record<OrderStatus, { label: string; next: OrderStatus; tone: "primary" | "ghost" | "danger" }[]> = {
  upcoming: [
    { label: "Mark active", next: "active", tone: "primary" },
    { label: "Cancel", next: "cancelled", tone: "danger" },
  ],
  active: [
    { label: "Mark completed", next: "completed", tone: "primary" },
    { label: "Cancel", next: "cancelled", tone: "danger" },
  ],
  completed: [],
  cancelled: [],
};

export default function OrderActions({
  orderId,
  currentStatus,
}: {
  orderId: number;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions = NEXT_BY_STATUS[currentStatus] ?? [];

  if (actions.length === 0) return null;

  async function apply(next: OrderStatus) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Update failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a.next}
          onClick={() => apply(a.next)}
          disabled={pending}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 " +
            (a.tone === "primary"
              ? "bg-gray-900 text-white hover:bg-gray-800"
              : a.tone === "danger"
              ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50")
          }
        >
          {pending ? "Updating…" : a.label}
        </button>
      ))}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
