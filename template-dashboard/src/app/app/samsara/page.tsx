import { unstable_noStore as noStore } from "next/cache";
import { getSamsaraDevices, getEquipmentOptions } from "@/lib/samsara-queries";
import { isSamsaraConfigured } from "@/lib/samsara";
import SamsaraDevicesTable from "@/components/samsara-devices-table";

export const dynamic = "force-dynamic";

export default async function SamsaraPage() {
  noStore();
  const [devices, equipmentOptions] = await Promise.all([
    getSamsaraDevices(),
    getEquipmentOptions(),
  ]);
  const configured = isSamsaraConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Samsara Devices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage GPS tracker devices. Click <strong>Sync from Samsara</strong> to pull
          the latest asset list. Each device can be linked to a piece of equipment and
          tagged with notes (e.g., &quot;battery dead&quot;).
        </p>
      </div>

      {!configured && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Samsara not configured.</strong> Set <code>SAMSARA_API_TOKEN</code> in
          your environment variables, then redeploy. Until then, you can still edit
          notes on devices already in the database, but Sync will fail.
        </div>
      )}

      <SamsaraDevicesTable devices={devices} equipmentOptions={equipmentOptions} />
    </div>
  );
}
