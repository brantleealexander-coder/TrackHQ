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

function SectionHeader({ title, accent }: { title: string; accent?: "default" | "danger" }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2
        className={
          "text-xs font-semibold uppercase tracking-wider " +
          (accent === "danger" ? "text-red-600" : "text-gray-500")
        }
      >
        {title}
      </h2>
      <span className="h-px flex-1 bg-gray-200" aria-hidden />
    </div>
  );
}

export default function FinancialsGrid({
  fleet,
  revenue,
  overdue,
  revenueByUnit,
  maintenance,
  maintenanceByUnit,
}: FinancialsGridProps) {
  const maintMap = new Map(
    maintenanceByUnit.map((m) => [m.equipmentId, m.totalMaintenance])
  );

  return (
    <div className="space-y-10">
      {/* Revenue */}
      <section>
        <SectionHeader title="Revenue · closed rentals" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="This month" value={formatCurrency(revenue.monthlyRevenue)} accent="green" primary />
          <StatCard label="YTD" value={formatCurrency(revenue.ytdRevenue)} accent="brand" />
          <StatCard label="Active (projected)" value={formatCurrency(revenue.activeRentRevenue)} sub="Based on current rental periods" accent="amber" />
          <StatCard label="All-time" value={formatCurrency(revenue.totalAllTime)} accent="gray" />
        </div>
      </section>

      {/* Maintenance */}
      <section>
        <SectionHeader title="Maintenance costs" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="This month" value={formatCurrency(maintenance.monthlyMaintenance)} accent="red" />
          <StatCard label="YTD" value={formatCurrency(maintenance.ytdMaintenance)} accent="red" />
          <StatCard label="All-time" value={formatCurrency(maintenance.totalAllTimeMaintenance)} accent="red" />
        </div>
      </section>

      {/* Net */}
      <section>
        <SectionHeader title="Net profit · revenue − maintenance" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="This month"
            value={formatCurrency(revenue.monthlyRevenue - maintenance.monthlyMaintenance)}
            accent={revenue.monthlyRevenue >= maintenance.monthlyMaintenance ? "green" : "orange"}
          />
          <StatCard
            label="YTD"
            value={formatCurrency(revenue.ytdRevenue - maintenance.ytdMaintenance)}
            accent={revenue.ytdRevenue >= maintenance.ytdMaintenance ? "green" : "orange"}
          />
          <StatCard
            label="All-time"
            value={formatCurrency(revenue.totalAllTime - maintenance.totalAllTimeMaintenance)}
            accent={revenue.totalAllTime >= maintenance.totalAllTimeMaintenance ? "green" : "orange"}
          />
        </div>
      </section>

      {/* Utilization */}
      <section>
        <SectionHeader title="Utilization" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-semibold tracking-tight tabular-nums text-gray-900">
                {fleet.utilization}%
              </p>
              <p className="mt-1 text-sm text-gray-500">of rentable fleet is on rent</p>
            </div>
            <p className="text-xs tabular-nums text-gray-400">
              {fleet.totalUnits} total units
            </p>
          </div>
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${fleet.utilization}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
            <BulletStat color="bg-emerald-500" label="On rent" value={fleet.onRentCount} />
            <BulletStat color="bg-blue-500" label="Available" value={fleet.availableCount} />
            <BulletStat color="bg-amber-500" label="Reserved" value={fleet.reservedCount} />
            <BulletStat color="bg-red-500" label="Down" value={fleet.downCount} />
          </div>
        </div>
      </section>

      {/* Overdue */}
      {overdue.length > 0 && (
        <section>
          <SectionHeader title={`Overdue rentals · ${overdue.length}`} accent="danger" />
          <div className="overflow-x-auto rounded-2xl border border-red-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-red-50/60">
                <tr className="border-b border-red-100 text-left text-[11px] font-semibold uppercase tracking-wider text-red-700">
                  <th className="px-4 py-2.5">GL Code</th>
                  <th className="px-4 py-2.5">Asset</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Due date</th>
                  <th className="px-4 py-2.5 text-right">Days overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overdue.map((row) => (
                  <tr key={row.glCode} className="transition-colors hover:bg-red-50/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{row.glCode}</td>
                    <td className="px-4 py-2.5 text-gray-900">{row.equipmentName}</td>
                    <td className="px-4 py-2.5 text-gray-700">{row.customerName}</td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(row.rentalEnd)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-red-600">{row.daysOverdue}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Per-unit performance */}
      {revenueByUnit.length > 0 && (
        <section>
          <SectionHeader title="Performance by unit · all time" />
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50/80">
                <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">GL Code</th>
                  <th className="px-4 py-2.5">Asset</th>
                  <th className="px-4 py-2.5 text-right">Revenue</th>
                  <th className="px-4 py-2.5 text-right">Maintenance</th>
                  <th className="px-4 py-2.5 text-right">Net profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revenueByUnit.map((row, i) => {
                  const maint = maintMap.get(row.equipmentId) ?? 0;
                  const net = row.totalRevenue - maint;
                  return (
                    <tr key={row.equipmentId} className="transition-colors hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{row.glCode}</td>
                      <td className="px-4 py-2.5 text-gray-900">{row.equipmentName}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(row.totalRevenue)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{maint > 0 ? formatCurrency(maint) : "—"}</td>
                      <td className={
                        "px-4 py-2.5 text-right font-semibold tabular-nums " +
                        (net >= 0 ? "text-emerald-700" : "text-orange-600")
                      }>
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
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-700">No rental history yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Revenue data will appear here once rentals are logged via the admin form.
          </p>
        </div>
      )}
    </div>
  );
}

function BulletStat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="font-semibold tabular-nums text-gray-900">{value}</span>
      <span className="text-gray-500">{label}</span>
    </span>
  );
}
