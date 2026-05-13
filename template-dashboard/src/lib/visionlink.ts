// Cat VisionLink ISO 15143-3 (AEMP 2.0) API client
// Uses OAuth2 client credentials flow via Microsoft Azure AD (Entra ID)
// Docs: https://digital.cat.com/apis/api-list/prod/iso15143-aemp-20

const AEMP_BASE_URL = "https://services.cat.com/telematics/iso15143";

// In-memory token cache (refreshed when expired, 60-min token TTL)
let cachedToken: { access_token: string; expires_at: number } | null = null;

// --- OAuth2 client credentials flow ---

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 5 * 60 * 1000) {
    return cachedToken.access_token;
  }

  const tokenUrl = process.env.VISIONLINK_TOKEN_URL!;
  const clientId = process.env.VISIONLINK_CLIENT_ID!;
  const clientSecret = process.env.VISIONLINK_CLIENT_SECRET!;
  const scope = process.env.VISIONLINK_SCOPE!;

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VisionLink token error: ${res.status} — ${text}`);
  }

  const body = await res.json();
  cachedToken = {
    access_token: body.access_token,
    expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
  };

  return cachedToken.access_token;
}

// --- AEMP API fetch ---

async function aempFetch(path: string): Promise<any> {
  const token = await getAccessToken();
  const url = `${AEMP_BASE_URL}${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/iso15143-snapshot+json",
    },
  });

  if (res.status === 401) {
    cachedToken = null;
    const freshToken = await getAccessToken();
    const retry = await fetch(url, {
      headers: {
        Authorization: `Bearer ${freshToken}`,
        Accept: "application/iso15143-snapshot+json",
      },
    });
    if (!retry.ok) throw new Error(`AEMP API error: ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`AEMP API error: ${res.status}`);
  return res.json();
}

// --- Data types ---

export interface TelematicsAsset {
  serialNumber: string;
  make: string;
  model: string;
  equipmentId: string;
  latitude: number | null;
  longitude: number | null;
  locationTimestamp: string | null;
  cumulativeHours: number | null;
  hoursTimestamp: string | null;
  idleHours: number | null;
  fuelRemainingPercent: number | null;
  defRemainingPercent: number | null;
  fuelConsumed: number | null;
  odometer: number | null;
  engineRunning: boolean | null;
  faultCodes: FaultCode[];
  lastCommunication: string | null;
}

export interface FaultCode {
  spn: string;
  fmi: string;
  occurrenceCount: number;
  description: string;
  severity: string;
  timestamp: string;
}

export interface TelematicsData {
  configured: boolean;
  assets: TelematicsAsset[];
  fetchedAt: string;
}

// --- Parse AEMP 2.0 fleet snapshot equipment ---
// Based on actual Cat API response format from developer guide

function parseEquipment(eq: any): TelematicsAsset {
  const header = eq.EquipmentHeader ?? {};
  const location = eq.Location ?? {};
  const hours = eq.CumulativeOperatingHours ?? {};
  const idleHours = eq.CumulativeIdleHours ?? {};
  const fuel = eq.FuelRemaining ?? {};
  const def = eq.DEFRemaining ?? {};
  const fuelUsed = eq.FuelUsed ?? {};
  const distance = eq.Distance ?? {};
  const engine = eq.EngineStatus ?? {};

  // Location fields — Cat uses "Datetime" (capital D, lowercase t)
  const locDatetime = location.Datetime ?? location.datetime ?? location.DateTime ?? null;
  const hoursDatetime = hours.Datetime ?? hours.datetime ?? hours.DateTime ?? null;

  return {
    serialNumber: header.SerialNumber ?? "",
    make: header.OEMName ?? "CAT",
    model: header.Model ?? "",
    equipmentId: header.EquipmentID ?? "",
    latitude: parseFloat(location.Latitude ?? location.latitude) || null,
    longitude: parseFloat(location.Longitude ?? location.longitude) || null,
    locationTimestamp: locDatetime,
    cumulativeHours: parseFloat(hours.Hour) || null,
    hoursTimestamp: hoursDatetime,
    idleHours: parseFloat(idleHours.Hour) || null,
    fuelRemainingPercent: parseFloat(fuel.Percent) || null,
    defRemainingPercent: parseFloat(def.Percent) || null,
    fuelConsumed: parseFloat(fuelUsed.FuelConsumed) || null,
    odometer: parseFloat(distance.Odometer) || null,
    engineRunning: engine.Running === true || engine.Running === "True" || engine.Running === "true" ? true
      : engine.Running === false || engine.Running === "False" || engine.Running === "false" ? false
      : null,
    // Fault codes are NOT in the fleet snapshot — they require per-equipment timeseries calls
    faultCodes: [],
    lastCommunication: locDatetime ?? hoursDatetime ?? null,
  };
}

// --- Public API ---

export function isVisionLinkConfigured(): boolean {
  return !!(
    process.env.VISIONLINK_CLIENT_ID &&
    process.env.VISIONLINK_CLIENT_SECRET &&
    process.env.VISIONLINK_TOKEN_URL &&
    process.env.VISIONLINK_SCOPE
  );
}

// Fetch all fleet data with pagination (100 assets per page)
export async function fetchFleetTelematics(): Promise<TelematicsData> {
  if (!isVisionLinkConfigured()) {
    return { configured: false, assets: [], fetchedAt: new Date().toISOString() };
  }

  const allAssets: TelematicsAsset[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 50) {
    const raw = await aempFetch(`/fleet/${page}`);
    const equipmentList = raw?.Equipment ?? [];

    if (Array.isArray(equipmentList) && equipmentList.length > 0) {
      allAssets.push(...equipmentList.map(parseEquipment));
    }

    // Check pagination links for "Next"
    const links = raw?.Links ?? [];
    const nextLink = links.find((l: any) => l.Rel === "Next" || l.rel === "Next");
    hasMore = !!nextLink;
    page++;
  }

  return {
    configured: true,
    assets: allAssets,
    fetchedAt: new Date().toISOString(),
  };
}

// Fetch single equipment snapshot by make/model/serial
export async function fetchAssetTelematics(
  make: string,
  model: string,
  serialNumber: string
): Promise<TelematicsAsset | null> {
  if (!isVisionLinkConfigured()) return null;

  try {
    const raw = await aempFetch(
      `/equipment/makeModelSerial/${encodeURIComponent(make)}/${encodeURIComponent(model)}/${encodeURIComponent(serialNumber)}`
    );
    if (!raw) return null;
    return parseEquipment(raw);
  } catch {
    return null;
  }
}

// Fetch fault codes for a specific unit (14-day rolling window)
export async function fetchAssetFaults(
  make: string,
  model: string,
  serialNumber: string
): Promise<FaultCode[]> {
  if (!isVisionLinkConfigured()) return [];

  try {
    const now = new Date();
    const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const startStr = start.toISOString().replace(/\.\d{3}Z$/, "Z");
    const endStr = now.toISOString().replace(/\.\d{3}Z$/, "Z");

    const raw = await aempFetch(
      `/equipment/makeModelSerial/${encodeURIComponent(make)}/${encodeURIComponent(model)}/${encodeURIComponent(serialNumber)}/faults/${startStr}/${endStr}/1`
    );

    const faults = raw?.FaultCode ?? [];
    return (Array.isArray(faults) ? faults : []).map((f: any) => ({
      spn: f.CodeIdentifier ?? "",
      fmi: "",
      occurrenceCount: 1,
      description: f.CodeDescription ?? "Unknown fault",
      severity: f.CodeSeverity ?? "Medium",
      timestamp: f.Datetime ?? f.datetime ?? "",
    }));
  } catch {
    return [];
  }
}
