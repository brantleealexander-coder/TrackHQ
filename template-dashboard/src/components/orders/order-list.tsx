import Link from "next/link";
import type { OrderRow } from "@/lib/order-queries";

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtCurrency(n: number | null): string {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "upcoming") return "bg-brand-50 text-brand-700 ring-brand-200";
  if (status === "completed") return "bg-gray-100 text-gray-700 ring-gray-200";
  if (status === "cancelled") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function sourceIcon(source: string): { label: string; cls: string } {
  if (source === "voice") return { label: "Voice", cls: "bg-purple-50 text-purple-700" };
  if (source === "web") return { label: "Web", cls: "bg-amber-50 text-amber-700" };
  return { label: "Operator", cls: "bg-gray-100 text-gray-600" };
}

export default function OrderList({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-base font-medium text-gray-700">No orders in this tab.</p>
        <p className="mt-1 text-sm text-gray-500">
          Try a different tab or start a new order from the sidebar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-gray-50/80">
          <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-4 py-2.5">#</th>
            <th className="px-4 py-2.5">Customer</th>
            <th className="px-4 py-2.5">Source</th>
            <th className="px-4 py-2.5">Start</th>
            <th className="px-4 py-2.5">End</th>
            <th className="px-4 py-2.5">Assets</th>
            <th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((o) => {
            const src = sourceIcon(o.source);
            return (
              <tr key={o.id} className="group transition-colors hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-brand-600">
                  <Link href={`/app/orders/${o.id}`} className="hover:text-brand-700">
                    #{String(o.id).padStart(5, "0")}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-900">
                  <Link href={`/app/orders/${o.id}`} className="hover:text-brand-700">
                    {o.customer_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${src.cls}`}>
                    {src.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(o.rental_start)}</td>
                <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(o.rental_end)}</td>
                <td className="px-4 py-2.5 tabular-nums text-gray-500">{o.asset_count}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                  {fmtCurrency(o.total)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      "inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset " +
                      statusBadgeClass(o.status)
                    }
                  >
                    {o.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
