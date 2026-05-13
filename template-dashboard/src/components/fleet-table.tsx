"use client";

import { useState } from "react";
import Link from "next/link";
import type { FleetRow } from "@/lib/types";
import StatusBadge from "./status-badge";

interface FleetTableProps {
  rows: FleetRow[];
  divisionName: string;
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

export default function FleetTable({ rows, divisionName }: FleetTableProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-3 text-left"
      >
        <span className="text-xs text-gray-400 select-none">
          {open ? "▼" : "▶"}
        </span>
        <h2 className="text-base font-semibold text-gray-700">{divisionName}</h2>
        <span className="text-xs text-gray-400">({rows.length})</span>
      </button>

      {open && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">GL Code</th>
                <th className="px-4 py-3">Equipment</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3 text-right">Daily</th>
                <th className="px-4 py-3 text-right">Weekly</th>
                <th className="px-4 py-3 text-right">Monthly</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Job / PO</th>
                <th className="px-4 py-3">Rental Start</th>
                <th className="px-4 py-3">Rental End</th>
                <th className="px-4 py-3">Home Yard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    <Link
                      href={`/fleet/${row.id}`}
                      className="text-orange-600 hover:text-orange-800 hover:underline"
                    >
                      {row.gl_code}
                    </Link>
                    {row.is_cross_charge && (
                      <span className="ml-1 text-xs text-purple-500" title="Cross-charge unit">
                        CC
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                    {row.equipment_name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.year ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                    {fmt(row.rate_daily)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                    {fmt(row.rate_weekly)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                    {fmt(row.rate_monthly)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">
                    {row.customer_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">
                    {row.job_po_notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {fmtDate(row.rental_start)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {fmtDate(row.rental_end)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                    {row.home_yard ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
