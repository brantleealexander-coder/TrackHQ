import { unstable_noStore as noStore } from "next/cache";
import { getFleet } from "@/lib/queries";
import { fetchFleetTelematics, isVisionLinkConfigured } from "@/lib/visionlink";
import { fetchSamsaraAssets, isSamsaraConfigured } from "@/lib/samsara";
import { getSamsaraDevices } from "@/lib/samsara-queries";
import FleetMap from "@/components/fleet-map";
import AutoRefresh from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  noStore();

  const [fleet, telematics, samsaraDevices, samsaraAssets] = await Promise.all([
    getFleet(),
    isVisionLinkConfigured() ? fetchFleetTelematics().catch(() => null) : Promise.resolve(null),
    getSamsaraDevices().catch(() => []),
    isSamsaraConfigured() ? fetchSamsaraAssets().catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <div>
      <AutoRefresh intervalMs={60_000} />
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Fleet Map</h1>
      <FleetMap
        fleet={fleet}
        telematics={telematics?.assets ?? null}
        samsaraDevices={samsaraDevices}
        samsaraAssets={samsaraAssets}
      />
    </div>
  );
}
