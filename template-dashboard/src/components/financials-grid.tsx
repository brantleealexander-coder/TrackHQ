import type {
  RevenueSummary,
  OverdueRental,
  RevenueByUnit,
  FleetSummary,
  MaintenanceSummary,
  MaintenanceByUnit,
} from "@/lib/financials";
import { formatCurrency } from "@/lib/financials";
import StatCard from "./stat-card";

interface FinancialsGridProps {
  fleet: FleetSummary;
  revenue: RevenueSummary;
  overdue: OverdueRental[];
  revenueByUnit: RevenueByUnit[];
  maintenance: MaintenanceSummary;
  maintenanceByUnit: MaintenanceByUnit[];
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FinancialsGrid({
  fleet,
  revenue,
  overdue,
  revenueByUnit,
  maintenance,
  maintenanceByUnit,
}: FinancialsGridProps) {
  // Build maintenance lookup by equipmentId for the per-unit table
  const maintMap = new Map(
    maintenanceByUnit.map((m) => [m.equipmentId, m.totalMaintenance])
  );

  return (
    <div className="space-y-10">
      {/* Revenue summary cards */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4">Revenue (Closed Rentals)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="This Month"
            value={formatCurrency(revenue.monthlyRevenue)}
            accent="green"
          />
          <StatCard
            label="YTD"
            value={formatCurrency(revenue.ytdRevenue)}
            accent="blue"
          />
          <StatCard
            label="Active (Projected)"
            value={formatCurrency(revenue.activeRentRevenue)}
            sub="Based on current rental periods"
            accent="amber"
          />
          <StatCard
            label="All-Time"
            value={formatCurrency(revenue.totalAllTime)}
            accent="gray"
          />
        </div>
      </section>

      {/* Maintenance cost cards */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4">Maintenance Costs</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="This Month"
            value={formatCurrency(maintenance.monthlyMaintenance)}
            accent="red"
          />
          <StatCard
            label="YTD"
            value={formatCurrency(maintenance.ytdMaintenance)}
            accent="red"
          />
          <StatCard
            label="All-Time"
            value={formatCurrency(maintenance.totalAllTimeMaintenance)}
            accent="red"
          />
        </div>
      </section>

      {/* Net profit cards */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4">Net Profit (Revenue − Maintenance)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="This Month"
            value={formatCurrency(revenue.monthlyRevenue - maintenance.monthlyMaintenance)}
            accent={revenue.monthlyRevenue >= maintenance.monthlyMaintenance ? "green" : "orange"}
          />
          <StatCard
            label="YTD"
            value={formatCurrency(revenue.ytdRevenue - maintenance.ytdMaintenance)}
            accent={revenue.ytdRevenue >= maintenance.ytdMaintenance ? "green" : "orange"}
          />
          <StatCard
            label="All-Time"
            value={formatCurrency(revenue.totalAllTime - maintenance.totalAllTimeMaintenance)}
            accent={revenue.totalAllTime >= maintenance.totalAllTimeMaintenance ? "green" : "orange"}
          />
        </div>
      </section>

      {/* Fleet utilization */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4">Utilization</h2>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-end gap-3 mb-4">
            <span className="text-5xl font-bold text-gray-900">
              {fleet.utilization}%
            </span>
            <span className="text-gray-500 mb-1.5 text-sm">
              of rentable fleet is on rent
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full bg-green-500 transition-all"
              style={{ width: `${fleet.utilization}%` }}
            />
          </div>
          <div className="flex gap-6 mt-4 text-sm text-gray-600">
            <span>
              <strong className="text-green-600">{fleet.onRentCount}</strong> On Rent
            </span>
            <span>
              <strong className="text-blue-600">{fleet.availableCount}</strong> Available
            </span>
            <span>
              <strong className="text-amber-600">{fleet.reservedCount}</strong> Reserved
            </span>
            <span>
              <strong className="text-red-600">{fleet.downCount}</strong> Down
            </span>
            <span className="text-gray-400">
              {fleet.totalUnits} total units
            </span>
          </div>
        </div>
      </section>

      {/* Overdue rentals */}
      {overdue.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-red-600 mb-4">
            Overdue Rentals ({overdue.length})
          </h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">GL Code</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Days Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {overdue.map((row) => (
                  <tr key={row.glCode} className="hover:bg-red-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.glCode}</td>
                    <td className="px-4 py-3 text-gray-900">{row.equipmentName}</td>
                    <td className="px-4 py-3 text-gray-700">{row.customerName}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(row.rentalEnd)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {row.daysOverdue}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Revenue + maintenance by unit */}
      {revenueByUnit.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            Performance by Unit (All Time)
          </h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">GL Code</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Maintenance</th>
                  <th className="px-4 py-3 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {revenueByUnit.map((row, i) => {
                  const maint = maintMap.get(row.equipmentId) ?? 0;
                  const net = row.totalRevenue - maint;
                  return (
                    <tr key={row.equipmentId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.glCode}</td>
                      <td className="px-4 py-3 text-gray-900">{row.equipmentName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(row.totalRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {maint > 0 ? formatCurrency(maint) : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${net >= 0 ? "text-green-700" : "text-orange-600"}`}>
                        {formatCurrency(net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {revenueByUnit.length === 0 && overdue.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          <p className="text-lg">No rental history yet.</p>
          <p className="text-sm mt-1">
            Revenue data will appear here once rentals are logged via the admin form.
          </p>
        </div>
      )}
    </div>
  );
}
