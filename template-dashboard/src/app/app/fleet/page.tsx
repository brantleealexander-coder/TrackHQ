import { unstable_noStore as noStore } from "next/cache";
import { getFleet, getStatusCounts, getStatuses } from "@/lib/queries";
import { computeFleetSummary } from "@/lib/financials";
import { requireMembership } from "@/lib/auth";
import FleetTable from "@/components/fleet-table";
import StatCard from "@/components/stat-card";
import type { FleetRow } from "@/lib/types";
import { getTenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  noStore();
  const { company_id } = await requireMembership();
  const [fleet, statusCounts, statuses] = await Promise.all([
    getFleet(company_id),
    getStatusCounts(company_id),
    getStatuses(),
  ]);

  const { terminology } = getTenantConfig();
  const summary = computeFleetSummary(statusCounts, fleet.length, statuses);

  // Group by category
  const byCategory = new Map<number, { name: string; rows: FleetRow[] }>();
  for (const row of fleet) {
    if (!byCategory.has(row.category_id)) {
      byCategory.set(row.category_id, { name: row.category_name, rows: [] });
    }
    byCategory.get(row.category_id)!.rows.push(row);
  }
  const categories = Array.from(byCategory.entries()).sort(([a], [b]) => a - b);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{terminology.asset_plural}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {summary.totalUnits} units across {categories.length} categories
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="On Rent"
          value={summary.onRentCount}
          sub={`${summary.utilization}% utilization`}
          accent="orange"
        />
        <StatCard
          label="Available"
          value={summary.availableCount}
          accent="blue"
        />
        <StatCard
          label="Reserved"
          value={summary.reservedCount}
          accent="amber"
        />
        <StatCard
          label="Down"
          value={summary.downCount}
          accent="red"
        />
      </div>

      {/* Equipment tables by category */}
      {categories.map(([catId, { name, rows }]) => (
        <FleetTable key={catId} rows={rows} categoryName={name} statuses={statuses} />
      ))}
    </div>
  );
}
