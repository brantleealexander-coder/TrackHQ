import { unstable_noStore as noStore } from "next/cache";
import {
  getEquipmentList,
  getStatuses,
  getCategories,
  getLocations,
} from "@/lib/queries";
import { requireMembership } from "@/lib/auth";
import StatusForm from "@/components/status-form";
import AddEquipmentForm from "@/components/add-equipment-form";
import RemoveEquipmentForm from "@/components/remove-equipment-form";
import { getTenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  noStore();
  const membership = await requireMembership();
  const [equipment, statuses, categories, locations] = await Promise.all([
    getEquipmentList(membership.company_id),
    getStatuses(),
    getCategories(membership.company_id),
    getLocations(membership.company_id),
  ]);

  const { terminology } = getTenantConfig();
  // Members can update status on existing equipment (yard-floor task) but
  // can't add new equipment with rates or remove existing equipment.
  const canManageInventory = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="space-y-12">
      {/* Update Status */}
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Update {terminology.asset_singular} Status</h1>
          <p className="text-sm text-gray-500 mt-1">
            Select a unit and enter its current rental status. Changes are saved instantly and reflected on the {terminology.asset_plural} and Financials pages.
          </p>
        </div>
        <StatusForm equipment={equipment as never} statuses={statuses} />
      </div>

      {canManageInventory && (
        <>
          {/* Divider */}
          <hr className="border-gray-200" />

          {/* Add New Equipment */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add New {terminology.asset_singular}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Add a newly purchased or transferred unit. It will appear as available immediately.
              </p>
            </div>
            <AddEquipmentForm categories={categories} locations={locations} />
          </div>

          {/* Divider */}
          <hr className="border-gray-200" />

          {/* Remove Equipment */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Remove {terminology.asset_singular}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Permanently remove a sold or retired unit.
              </p>
            </div>
            <RemoveEquipmentForm equipment={equipment as never} />
          </div>
        </>
      )}
    </div>
  );
}
