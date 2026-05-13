import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getUnitDetail,
  getUnitRentalHistory,
  getUnitMaintenanceLogs,
} from "@/lib/queries";
import { formatCurrency } from "@/lib/financials";
import StatusBadge from "@/components/status-badge";
import UnitHistory from "@/components/unit-history";
import type { EquipmentWithStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UnitDetailPage({
  params,
}: {
  params: { id: string };
}) {
  noStore();
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const [rawUnit, rentalHistory, maintenanceLogs] = await Promise.all([
    getUnitDetail(id).catch(() => null),
    getUnitRentalHistory(id),
    getUnitMaintenanceLogs(id),
  ]);

  if (!rawUnit) notFound();

  const unit = rawUnit as unknown as EquipmentWithStatus & {
    divisions: { name: string } | null;
  };
  const currentStatus = (unit.equipment_status as { status: string }[] | null)?.[0];
  const divisionName = unit.divisions?.name ?? `Division ${unit.division_id}`;

  // Financial summary for this unit
  const totalRevenue = rentalHistory.reduce(
    (sum, r) => sum + (r.revenue_amount ?? 0),
    0
  );
  const totalMaintenance = maintenanceLogs.reduce(
    (sum, m) => sum + (m.cost ?? 0),
    0
  );
  const netProfit = totalRevenue - totalMaintenance;

  return (
    <div>
      {/* Back link */}
      <Link
        href="/fleet"
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 mb-6"
      >
        ← Back to Fleet
      </Link>

      {/* Unit header */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500 font-mono mb-1">{unit.gl_code}</p>
            <h1 className="text-2xl font-bold text-gray-900">{unit.equipment_name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {divisionName}
              {unit.year && ` · ${unit.year}`}
              {unit.home_yard && ` · ${unit.home_yard}`}
            </p>
          </div>
          {currentStatus && (
            <StatusBadge status={currentStatus.status as never} />
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-400">
          <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-red-400">
          <p className="text-sm text-gray-500 font-medium">Total Maintenance</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(totalMaintenance)}</p>
        </div>
        <div className={`bg-white rounded-xl p-6 shadow-sm border-l-4 ${netProfit >= 0 ? "border-blue-400" : "border-orange-400"}`}>
          <p className="text-sm text-gray-500 font-medium">Net Profit</p>
          <p className={`text-3xl font-bold mt-1 ${netProfit >= 0 ? "text-gray-900" : "text-orange-600"}`}>
            {formatCurrency(netProfit)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-gray-300">
          <p className="text-sm text-gray-500 font-medium">Rental Events</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{rentalHistory.length}</p>
          <p className="text-xs text-gray-400 mt-1">{maintenanceLogs.length} maintenance records</p>
        </div>
      </div>

      {/* History tables */}
      <UnitHistory rentalHistory={rentalHistory} maintenanceLogs={maintenanceLogs} />
    </div>
  );
}
