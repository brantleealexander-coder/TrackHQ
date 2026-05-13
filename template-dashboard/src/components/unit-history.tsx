"use client";

import { formatCurrency } from "@/lib/financials";

interface RentalRow {
  id: number;
  status_before: string | null;
  status_after: string;
  customer_name: string | null;
  job_po_notes: string | null;
  rate_type: string | null;
  rental_start: string | null;
  rental_end: string | null;
  revenue_amount: number | null;
  recorded_at: string;
}

interface MaintenanceRow {
  id: number;
  date: string;
  cost: number;
  description: string;
  vendor: string | null;
  category: string | null;
  invoice_number: string | null;
}

interface UnitHistoryProps {
  rentalHistory: RentalRow[];
  maintenanceLogs: MaintenanceRow[];
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UnitHistory({ rentalHistory, maintenanceLogs }: UnitHistoryProps) {
  return (
    <div className="space-y-10">
      {/* Rental History */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4">
          Rental History ({rentalHistory.length})
        </h2>
        {rentalHistory.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
            No rental history recorded yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date Recorded</th>
                  <th className="px-4 py-3">Status Change</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Job / PO</th>
                  <th className="px-4 py-3">Rental Start</th>
                  <th className="px-4 py-3">Rental End</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rentalHistory.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {fmtDateTime(row.recorded_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">
                      {row.status_before ? (
                        <span>{row.status_before} → {row.status_after}</span>
                      ) : (
                        <span>{row.status_after}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-[140px] truncate">
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
                    <td className="px-4 py-3 text-gray-500 capitalize whitespace-nowrap">
                      {row.rate_type ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {row.revenue_amount ? formatCurrency(row.revenue_amount) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Maintenance Log */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4">
          Maintenance Log ({maintenanceLogs.length})
        </h2>
        {maintenanceLogs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
            No maintenance records yet. Log maintenance from the "Log Maintenance" tab.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {maintenanceLogs.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {fmtDate(row.date)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                        {row.category ?? "Other"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                      {row.description}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">
                      {row.vendor ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {row.invoice_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700 whitespace-nowrap">
                      {formatCurrency(row.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
