"use client";

import type { QBBill, AgingRow } from "@/lib/qb-types";

interface PayablesTabProps {
  bills: QBBill[];
  aging: AgingRow[];
}

function fmt(n: number): string {
  if (n === 0) return "-";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export default function PayablesTab({ bills, aging }: PayablesTabProps) {
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
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Accounts Payable</h3>

      {/* Aging buckets */}
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

      {/* Bills table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bills.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No bills found</td></tr>
            ) : (
              bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{bill.vendorName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{bill.txnDate}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{bill.dueDate}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{fmt(bill.totalAmt)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{fmt(bill.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
