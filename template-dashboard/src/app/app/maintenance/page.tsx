import { unstable_noStore as noStore } from "next/cache";
import { getEquipmentList } from "@/lib/queries";
import MaintenanceForm from "@/components/maintenance-form";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  noStore();
  const equipment = await getEquipmentList();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Log Maintenance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Record maintenance work, repairs, and associated costs for any unit in the fleet.
        </p>
      </div>
      <MaintenanceForm equipment={equipment as never} />
    </div>
  );
}
