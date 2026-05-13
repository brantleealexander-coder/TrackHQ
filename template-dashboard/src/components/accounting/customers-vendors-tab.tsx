"use client";

import type { QBCustomer, QBVendor } from "@/lib/qb-types";

interface CustomersVendorsTabProps {
  customers: QBCustomer[];
  vendors: QBVendor[];
}

function fmt(n: number): string {
  if (n === 0) return "-";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export default function CustomersVendorsTab({ customers, vendors }: CustomersVendorsTabProps) {
  const sortedCustomers = [...customers].sort((a, b) => b.balance - a.balance);
  const sortedVendors = [...vendors].sort((a, b) => b.balance - a.balance);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Customers */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Customers <span className="text-sm font-normal text-gray-500">({customers.length})</span>
        </h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedCustomers.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-400">No customers</td></tr>
              ) : (
                sortedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-gray-900">{c.displayName}</div>
                      {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                    </td>
                    <td className={`px-4 py-2.5 text-sm text-right font-mono ${c.balance > 0 ? "text-amber-600 font-semibold" : "text-gray-500"}`}>
                      {fmt(c.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendors */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Vendors <span className="text-sm font-normal text-gray-500">({vendors.length})</span>
        </h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedVendors.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-400">No vendors</td></tr>
              ) : (
                sortedVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{v.displayName}</td>
                    <td className={`px-4 py-2.5 text-sm text-right font-mono ${v.balance > 0 ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                      {fmt(v.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
