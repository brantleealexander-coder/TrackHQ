"use client";

import type { AgingRow } from "@/lib/qb-types";

interface ReceivablesTabProps {
  aging: AgingRow[];
}

function fmt(n: number): string {
  if (n === 0) return "-";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

const bucketHeaders = ["Current", "1-30", "31-60", "61-90", "91+", "Total"];

export default function ReceivablesTab({ aging }: ReceivablesTabProps) {
  const totals = aging.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      days1to30: acc.days1to30 + r.days1to30,
      days31to60: acc.days31to60 + r.days31to60,
      days61to90: acc.days61to90 + r.days61to90,
      days91plus: acc.days91plus + r.days91plus,
      total: acc.total + r.total,
    }),
    { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days91plus: 0, total: 0 }
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Accounts Receivable Aging</h3>

      {/* Aging buckets summary */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: "Current", value: totals.current, color: "border-green-400" },
          { label: "1-30 Days", value: totals.days1to30, color: "border-blue-400" },
          { label: "31-60 Days", value: totals.days31to60, color: "border-amber-400" },
          { label: "61-90 Days", value: totals.days61to90, color: "border-orange-400" },
          { label: "91+ Days", value: totals.days91plus, color: "border-red-400" },
          { label: "Total", value: totals.total, color: "border-gray-400" },
        ].map((b) => (
          <div key={b.label} className={`bg-white rounded-lg p-3 shadow-sm border-l-4 ${b.color}`}>
            <p className="text-xs text-gray-500">{b.label}</p>
            <p className="text-lg font-bold text-gray-900">{fmt(b.value)}</p>
          </div>
        ))}
      </div>

      {/* Detail table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              {bucketHeaders.map((h) => (
                <th key={h} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {aging.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No receivables data</td></tr>
            ) : (
              aging.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">{fmt(row.current)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">{fmt(row.days1to30)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">{fmt(row.days31to60)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">{fmt(row.days61to90)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-red-600">{fmt(row.days91plus)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-gray-900">{fmt(row.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
