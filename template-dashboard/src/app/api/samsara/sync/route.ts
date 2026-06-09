import { NextResponse } from "next/server";
import {
  fetchSamsaraAssets,
  fetchSamsaraGateways,
  isSamsaraConfigured,
} from "@/lib/samsara";
import { upsertSamsaraDevice, getExistingSamsaraNames } from "@/lib/samsara-queries";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const { company_id } = await requireMembership();

  if (!isSamsaraConfigured()) {
    return NextResponse.json(
      { error: "SAMSARA_API_TOKEN not set on the server" },
      { status: 400 }
    );
  }

  let assets;
  try {
    assets = await fetchSamsaraAssets();
  } catch (err: any) {
    return NextResponse.json({ error: `Samsara API: ${err.message}` }, { status: 502 });
  }

  let serialByAssetId: Record<string, string> = {};
  let gatewayWarning: string | null = null;
  try {
    const gateways = await fetchSamsaraGateways();
    for (const g of gateways) {
      if (g.assetId && g.serial) serialByAssetId[g.assetId] = g.serial;
    }
  } catch (err: any) {
    gatewayWarning = `Could not fetch gateway hardware serials (${err.message}). Verify the token has the "Read Devices" scope.`;
  }

  let existingNames: Record<string, string | null> = {};
  try {
    existingNames = await getExistingSamsaraNames(company_id);
  } catch (err: any) {
    console.error("Could not pre-fetch existing names:", err.message);
  }

  let upserted = 0;
  let skipped = 0;
  for (const a of assets) {
    if (!a.id) {
      skipped++;
      continue;
    }
    try {
      const resolvedSerial = serialByAssetId[a.id];

      const existingName = existingNames[a.id];
      const isFirstSeen = !(a.id in existingNames);
      const writeName = isFirstSeen || existingName == null;

      await upsertSamsaraDevice(company_id, {
        samsara_id: a.id,
        ...(writeName ? { samsara_name: a.name || null } : {}),
        ...(resolvedSerial ? { gateway_serial: resolvedSerial } : {}),
        last_seen_at: a.gpsTimestamp,
      });
      upserted++;
    } catch (err: any) {
      console.error(`Sync error for asset id "${a.id}":`, err.message);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    upserted,
    skipped,
    total: assets.length,
    serialsResolved: Object.keys(serialByAssetId).length,
    warning: gatewayWarning,
  });
}
