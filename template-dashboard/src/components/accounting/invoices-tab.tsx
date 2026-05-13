"use client";

import { useState } from "react";
import StatCard from "@/components/stat-card";
import type { QBInvoice } from "@/lib/qb-types";

interface InvoicesTabProps {
  invoices: QBInvoice[];
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

const statusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  open: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
};

export default function InvoicesTab({ invoices }: InvoicesTabProps) {
  const [filter, setFilter] = useState<"all" | "open" | "paid" | "overdue">("all");

  const filtered = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);
  const totalOpen = invoices.filter((i) => i.status === "open").reduce((s, i) => s + i.balance, 0);
  const totalOverdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.balance, 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.totalAmt, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Open Invoices" value={fmt(totalOpen)} accent="blue" sub={`${invoices.filter((i) => i.status === "open").length} invoices`} />
        <StatCard label="Overdue" value={fmt(totalOverdue)} accent="red" sub={`${invoices.filter((i) => i.status === "overdue").length} invoices`} />
        <StatCard label="Paid" value={fmt(totalPaid)} accent="green" sub={`${invoices.filter((i) => i.status === "paid").length} invoices`} />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "open", "overdue", "paid"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No invoices found</td></tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{inv.docNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{inv.customerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{inv.txnDate}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{inv.dueDate}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{fmt(inv.totalAmt)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{fmt(inv.balance)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
