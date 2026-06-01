"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FleetRow, Status } from "@/lib/types";
import StatusBadge from "./status-badge";

interface FleetTableProps {
  rows: FleetRow[];
  categoryName: string;
  statuses: Status[];
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FleetTable({ rows, categoryName, statuses }: FleetTableProps) {
  const [open, setOpen] = useState(true);
  const statusByKey = useMemo(
    () => new Map<string, Status>(statuses.map((s) => [s.key, s])),
    [statuses]
  );

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-gray-100"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            "h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform " +
            (open ? "rotate-90" : "")
          }
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <h2 className="text-sm font-semibold text-gray-900">{categoryName}</h2>
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 group-hover:bg-white">
          {rows.length}
        </span>
      </button>

      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur">
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5">GL Code</th>
                <th className="px-4 py-2.5">Asset</th>
                <th className="px-4 py-2.5">Year</th>
                <th className="px-4 py-2.5 text-right">Daily</th>
                <th className="px-4 py-2.5 text-right">Weekly</th>
                <th className="px-4 py-2.5 text-right">Monthly</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Job / PO</th>
                <th className="px-4 py-2.5">Start</th>
                <th className="px-4 py-2.5">End</th>
                <th className="px-4 py-2.5">Home</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="group transition-colors hover:bg-gray-50/60">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs tabular-nums">
                    <Link
                      href={`/app/fleet/${row.id}`}
                      className="font-medium text-brand-600 transition-colors hover:text-brand-700"
                    >
                      {row.gl_code}
                    </Link>
                    {row.is_cross_charge && (
                      <span className="ml-1 rounded bg-purple-50 px-1 py-0.5 text-[10px] font-semibold text-purple-700" title="Cross-charge unit">
                        CC
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-gray-900">{row.equipment_name}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{row.year ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-700">{fmt(row.rate_daily)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-700">{fmt(row.rate_weekly)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-700">{fmt(row.rate_monthly)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <StatusBadge status={row.status} statusInfo={statusByKey.get(row.status) ?? null} />
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-2.5 text-gray-700">{row.customer_name ?? "—"}</td>
                  <td className="max-w-[120px] truncate px-4 py-2.5 text-gray-500">{row.job_po_notes ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(row.rental_start)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(row.rental_end)}</td>
                  <td className="max-w-[160px] truncate px-4 py-2.5 text-xs text-gray-500">{row.home_location_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
