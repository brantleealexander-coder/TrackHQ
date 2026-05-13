import { NextResponse } from "next/server";
import {
  fetchSamsaraAssets,
  fetchSamsaraGateways,
  isSamsaraConfigured,
} from "@/lib/samsara";
import { upsertSamsaraDevice, getExistingSamsaraNames } from "@/lib/samsara-queries";

export const dynamic = "force-dynamic";

export async function POST() {
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

  // Pull gateway hardware serials in parallel-ish. If this fails (commonly
  // because the token lacks the "Read Devices" scope) we still proceed with
  // the rest of the sync so users can at least see their device list. We
  // surface the failure in the response so they know to fix the scope.
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

  // Pre-fetch existing samsara_names so we can avoid clobbering user edits.
  // The dashboard is the source of truth for samsara_name once a value is set.
  let existingNames: Record<string, string | null> = {};
  try {
    existingNames = await getExistingSamsaraNames();
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
      // Only pass gateway_serial when /devices actually returned one for this
      // asset — passing undefined leaves the existing DB value alone, which
      // preserves any manually-entered serial.
      const resolvedSerial = serialByAssetId[a.id];

      // Only set samsara_name when the row is new OR existing name is null.
      // For rows that already have a user-edited name, we leave it alone.
      const existingName = existingNames[a.id];
      const isFirstSeen = !(a.id in existingNames);
      const writeName = isFirstSeen || existingName == null;

      await upsertSamsaraDevice({
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
