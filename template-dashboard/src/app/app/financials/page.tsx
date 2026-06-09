import { unstable_noStore as noStore } from "next/cache";
import {
  getFleet,
  getStatusCounts,
  getRentalHistory,
  getActiveRentals,
  getAllMaintenanceLogs,
  getStatuses,
} from "@/lib/queries";
import {
  computeFleetSummary,
  computeRevenueSummary,
  findOverdueRentals,
  computeRevenueByUnit,
  computeMaintenanceSummary,
  computeMaintenanceByUnit,
} from "@/lib/financials";
import { requireMembership } from "@/lib/auth";
import FinancialsGrid from "@/components/financials-grid";

export const dynamic = "force-dynamic";

export default async function FinancialsPage() {
  noStore();
  const { company_id } = await requireMembership();
  const [fleet, statusCounts, history, activeRentals, maintenanceLogs, statuses] = await Promise.all([
    getFleet(company_id),
    getStatusCounts(company_id),
    getRentalHistory(company_id),
    getActiveRentals(company_id),
    getAllMaintenanceLogs(company_id),
    getStatuses(),
  ]);

  const fleetSummary = computeFleetSummary(statusCounts, fleet.length, statuses);
  const revenueSummary = computeRevenueSummary(history, activeRentals as never);
  const overdue = findOverdueRentals(fleet, statuses);
  const maintenanceSummary = computeMaintenanceSummary(maintenanceLogs);

  const equipmentMap = new Map(
    fleet.map((row) => [
      row.id,
      { gl_code: row.gl_code, equipment_name: row.equipment_name },
    ])
  );
  const revenueByUnit = computeRevenueByUnit(history, equipmentMap);
  const maintenanceByUnit = computeMaintenanceByUnit(maintenanceLogs, equipmentMap);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
        <p className="text-sm text-gray-500 mt-1">
          Revenue is recorded when rental status changes are saved. Maintenance costs are logged separately.
        </p>
      </div>
      <FinancialsGrid
        fleet={fleetSummary}
        revenue={revenueSummary}
        overdue={overdue}
        revenueByUnit={revenueByUnit}
        maintenance={maintenanceSummary}
        maintenanceByUnit={maintenanceByUnit}
      />
    </div>
  );
}
