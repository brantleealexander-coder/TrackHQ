import { unstable_noStore as noStore } from "next/cache";
import { getFleet, getStatusCounts } from "@/lib/queries";
import { computeFleetSummary } from "@/lib/financials";
import FleetTable from "@/components/fleet-table";
import StatCard from "@/components/stat-card";
import type { FleetRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  noStore();
  const [fleet, statusCounts] = await Promise.all([
    getFleet(),
    getStatusCounts(),
  ]);

  const summary = computeFleetSummary(statusCounts, fleet.length);

  // Group by division
  const byDivision = new Map<number, { name: string; rows: FleetRow[] }>();
  for (const row of fleet) {
    if (!byDivision.has(row.division_id)) {
      byDivision.set(row.division_id, { name: row.division_name, rows: [] });
    }
    byDivision.get(row.division_id)!.rows.push(row);
  }
  const divisions = Array.from(byDivision.entries()).sort(([a], [b]) => a - b);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Fleet Status</h1>
        <p className="text-sm text-gray-500 mt-1">
          {summary.totalUnits} units across {divisions.length} divisions
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

      {/* Equipment tables by division */}
      {divisions.map(([divId, { name, rows }]) => (
        <FleetTable key={divId} rows={rows} divisionName={name} />
      ))}
    </div>
  );
}
