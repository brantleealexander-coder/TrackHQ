// Samsara API client — pulls live GPS locations for tracked assets.
// Bearer-token auth, no OAuth flow.
// Docs: https://developers.samsara.com/reference/v1getallassetcurrentlocations

const SAMSARA_BASE_URL = "https://api.samsara.com";

export interface SamsaraAsset {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  gpsTimestamp: string | null;
}

export interface SamsaraGateway {
  serial: string;
  model: string | null;
  assetId: string | null;
}

export function isSamsaraConfigured(): boolean {
  return Boolean(process.env.SAMSARA_API_TOKEN);
}

async function samsaraFetch(path: string): Promise<any> {
  const token = process.env.SAMSARA_API_TOKEN;
  if (!token) throw new Error("SAMSARA_API_TOKEN not set");

  const res = await fetch(`${SAMSARA_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Samsara API ${res.status}: ${text}`);
  }
  return res.json();
}

// Convert a possibly-Unix-ms timestamp to ISO string. Samsara legacy API
// returns `time` as a Unix ms integer; newer endpoints return ISO strings.
function normalizeTimestamp(t: unknown): string | null {
  if (t == null) return null;
  if (typeof t === "number") return new Date(t).toISOString();
  if (typeof t === "string") {
    if (/^\d+$/.test(t)) return new Date(Number(t)).toISOString();
    return t;
  }
  return null;
}

// Fetch every asset's most recent GPS location, paginated.
// Endpoint: GET /v1/fleet/assets/locations  (legacy but active; the modern
// /assets/location-and-speed/stream requires a startTime which doesn't fit
// "current snapshot" use cases.)
export async function fetchSamsaraAssets(): Promise<SamsaraAsset[]> {
  const out: SamsaraAsset[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ limit: "512" });
    if (cursor) params.set("startingAfter", cursor);
    const body = await samsaraFetch(`/v1/fleet/assets/locations?${params.toString()}`);

    // Response shape varies between legacy v1 (`assets`) and newer (`data`)
    const items: any[] = body?.assets ?? body?.data ?? [];
    for (const item of items) {
      // v1 returns `location` as an array (most recent fix at index 0).
      // Newer endpoints use a single object at `lastLocation` / `assetLocation`.
      const rawLoc = item?.location ?? item?.lastLocation ?? item?.assetLocation ?? null;
      const loc = Array.isArray(rawLoc) ? rawLoc[0] ?? {} : rawLoc ?? {};
      const lat = typeof loc.latitude === "number" ? loc.latitude : null;
      const lng = typeof loc.longitude === "number" ? loc.longitude : null;
      out.push({
        id: String(item.id ?? ""),
        name: String(item.name ?? "").trim(),
        latitude: lat,
        longitude: lng,
        gpsTimestamp: normalizeTimestamp(loc.timeMs ?? loc.time ?? loc.gpsTime ?? null),
      });
    }

    const next = body?.pagination?.endCursor;
    const hasNext = body?.pagination?.hasNextPage;
    if (!hasNext || !next || next === cursor) break;
    cursor = next;
  }

  return out;
}

// Fetch all gateways (VGs, AGs, dashcams) with their hardware serials and the
// asset they're currently installed on. Beta endpoint — Samsara explicitly
// flags it may change.
//
// Endpoint: GET /devices
// Required scope: Read Devices
//
// Returns gateways with `assetId === null` for any device not currently
// associated with an asset, which we don't store but don't crash on either.
export async function fetchSamsaraGateways(): Promise<SamsaraGateway[]> {
  const out: SamsaraGateway[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ limit: "512" });
    if (cursor) params.set("after", cursor);
    const body = await samsaraFetch(`/devices?${params.toString()}`);

    const items: any[] = body?.data ?? [];
    for (const item of items) {
      const serial = typeof item?.serial === "string" ? item.serial.trim() : "";
      if (!serial) continue;
      const assetId = item?.asset?.id != null ? String(item.asset.id) : null;
      out.push({
        serial,
        model: typeof item?.model === "string" ? item.model : null,
        assetId,
      });
    }

    const next = body?.pagination?.endCursor;
    const hasNext = body?.pagination?.hasNextPage;
    if (!hasNext || !next || next === cursor) break;
    cursor = next;
  }

  return out;
}
