import { unstable_noStore as noStore } from "next/cache";
import { getFleet, getStatuses, getLocations } from "@/lib/queries";
import { fetchFleetTelematics, isVisionLinkConfigured } from "@/lib/visionlink";
import { fetchSamsaraAssets, isSamsaraConfigured } from "@/lib/samsara";
import { getSamsaraDevices } from "@/lib/samsara-queries";
import { requireMembership } from "@/lib/auth";
import FleetMap from "@/components/fleet-map";
import AutoRefresh from "@/components/auto-refresh";
import { getTenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  noStore();
  const { company_id } = await requireMembership();

  const [fleet, statuses, locations, telematics, samsaraDevices, samsaraAssets] = await Promise.all([
    getFleet(company_id),
    getStatuses(),
    getLocations(company_id),
    isVisionLinkConfigured() ? fetchFleetTelematics().catch(() => null) : Promise.resolve(null),
    getSamsaraDevices(company_id).catch(() => []),
    isSamsaraConfigured() ? fetchSamsaraAssets().catch(() => null) : Promise.resolve(null),
  ]);

  const { terminology } = getTenantConfig();

  return (
    <div>
      <AutoRefresh intervalMs={60_000} />
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{terminology.asset_plural} Map</h1>
      <FleetMap
        fleet={fleet}
        statuses={statuses}
        locations={locations}
        telematics={telematics?.assets ?? null}
        samsaraDevices={samsaraDevices}
        samsaraAssets={samsaraAssets}
      />
    </div>
  );
}
