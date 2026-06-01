"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import MapboxMap, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
// @ts-ignore - CSS import handled by webpack
import "mapbox-gl/dist/mapbox-gl.css";
import type { FleetRow, SamsaraDeviceWithEquipment, Status, Location } from "@/lib/types";
import type { TelematicsAsset } from "@/lib/visionlink";
import type { SamsaraAsset } from "@/lib/samsara";

const SAMSARA_UNLINKED_GRAY = "#9ca3af";
const UNKNOWN_STATUS_COLOR = "#6b7280";

// Position units: VisionLink GPS > manual geocoded > home-location fallback.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[-\s_.#]/g, "").replace(/^0+/, "");
}

function spreadUnits(
  units: FleetRow[],
  telematics: TelematicsAsset[] | null,
  locationById: Map<number, Location>
): (FleetRow & { lat: number; lng: number; hasGps: boolean })[] {
  const yardCounts: Record<string, number> = {};

  const telematicsMap: Record<string, TelematicsAsset> = {};
  if (telematics) {
    for (const asset of telematics) {
      if (asset.serialNumber) telematicsMap[asset.serialNumber.toLowerCase()] = asset;
      if (asset.equipmentId) telematicsMap[asset.equipmentId.toLowerCase()] = asset;
      if (asset.serialNumber) telematicsMap[normalize(asset.serialNumber)] = asset;
      if (asset.equipmentId) telematicsMap[normalize(asset.equipmentId)] = asset;
    }
  }

  // Pick a default for units with no home location at all, so they still
  // appear somewhere on the map instead of disappearing.
  const defaultLoc = locationById.values().next().value ?? null;

  return units.map((unit) => {
    // 1. VisionLink GPS
    const sn = unit.serial_number ?? "";
    const vlMatch =
      (sn ? telematicsMap[sn.toLowerCase()] : undefined) ??
      (sn ? telematicsMap[normalize(sn)] : undefined) ??
      telematicsMap[unit.gl_code.toLowerCase()] ??
      telematicsMap[normalize(unit.gl_code)] ??
      telematicsMap[unit.equipment_name.toLowerCase()] ??
      telematicsMap[normalize(unit.equipment_name)];
    if (vlMatch?.latitude && vlMatch?.longitude) {
      if (Math.abs(vlMatch.latitude) <= 90 && Math.abs(vlMatch.longitude) <= 180) {
        return { ...unit, lat: vlMatch.latitude, lng: vlMatch.longitude, hasGps: true };
      }
    }

    // 2. Manually entered / geocoded coordinates
    if (unit.current_lat && unit.current_lng) {
      return { ...unit, lat: unit.current_lat, lng: unit.current_lng, hasGps: false };
    }

    // 3. Fall back to home location coords — tight circle around the
    //    yard so multiple units don't stack on the exact same pin.
    const loc =
      (unit.home_location_id != null ? locationById.get(unit.home_location_id) : undefined) ??
      defaultLoc;
    if (!loc || loc.latitude == null || loc.longitude == null) {
      // No usable coords anywhere — drop on (0, 0) so the unit is still
      // technically rendered. Better than throwing.
      return { ...unit, lat: 0, lng: 0, hasGps: false };
    }
    const yardKey = String(unit.home_location_id ?? "");
    const idx = yardCounts[yardKey] ?? 0;
    yardCounts[yardKey] = idx + 1;
    const angle = (idx / Math.max(1, yardCounts[yardKey])) * 2 * Math.PI + idx * 0.4;
    const radius = 0.0004; // ~50 meters
    return {
      ...unit,
      lat: loc.latitude + Math.sin(angle) * radius,
      lng: loc.longitude + Math.cos(angle) * radius,
      hasGps: false,
    };
  });
}

interface FleetMapProps {
  fleet: FleetRow[];
  statuses: Status[];
  locations: Location[];
  telematics?: TelematicsAsset[] | null;
  samsaraDevices?: SamsaraDeviceWithEquipment[];
  samsaraAssets?: SamsaraAsset[] | null;
}

type SamsaraMarker = SamsaraDeviceWithEquipment & {
  lat: number;
  lng: number;
  gpsTimestamp: string | null;
};

export default function FleetMap({
  fleet,
  statuses,
  locations,
  telematics,
  samsaraDevices = [],
  samsaraAssets = null,
}: FleetMapProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<(FleetRow & { lat: number; lng: number; hasGps: boolean }) | null>(null);
  const [selectedSamsara, setSelectedSamsara] = useState<SamsaraMarker | null>(null);
  const [samsaraNoteDraft, setSamsaraNoteDraft] = useState<string>("");
  const [savingNote, setSavingNote] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [yardFilter, setYardFilter] = useState<string>("all");

  const statusByKey = useMemo(
    () => new Map<string, Status>(statuses.map((s) => [s.key, s])),
    [statuses]
  );
  const locationById = useMemo(
    () => new Map<number, Location>(locations.map((l) => [l.id, l])),
    [locations]
  );

  const categories = useMemo(() => {
    const set = new Set(fleet.map((u) => u.category_name));
    return Array.from(set).sort();
  }, [fleet]);

  const units = useMemo(() => {
    let filtered = fleet;
    if (statusFilter !== "all") filtered = filtered.filter((u) => u.status === statusFilter);
    if (categoryFilter !== "all") filtered = filtered.filter((u) => u.category_name === categoryFilter);
    if (yardFilter !== "all") {
      const id = parseInt(yardFilter, 10);
      filtered = filtered.filter((u) => u.home_location_id === id);
    }
    return spreadUnits(filtered, telematics ?? null, locationById);
  }, [fleet, telematics, statusFilter, categoryFilter, yardFilter, locationById]);

  const samsaraMarkers = useMemo<SamsaraMarker[]>(() => {
    if (!samsaraDevices || samsaraDevices.length === 0) return [];
    const liveById: Record<string, SamsaraAsset> = {};
    if (samsaraAssets) {
      for (const a of samsaraAssets) {
        if (a.id) liveById[a.id] = a;
      }
    }
    const out: SamsaraMarker[] = [];
    for (const d of samsaraDevices) {
      if (!d.is_active) continue;
      const live = liveById[d.samsara_id];
      if (!live || live.latitude == null || live.longitude == null) continue;
      if (Math.abs(live.latitude) > 90 || Math.abs(live.longitude) > 180) continue;
      out.push({
        ...d,
        lat: live.latitude,
        lng: live.longitude,
        gpsTimestamp: live.gpsTimestamp ?? d.last_seen_at,
      });
    }
    return out;
  }, [samsaraDevices, samsaraAssets]);

  const handleMarkerClick = useCallback((unit: FleetRow & { lat: number; lng: number; hasGps: boolean }) => {
    setSelected(unit);
    setSelectedSamsara(null);
  }, []);

  const handleSamsaraClick = useCallback((m: SamsaraMarker) => {
    setSelectedSamsara(m);
    setSamsaraNoteDraft(m.notes ?? "");
    setSelected(null);
  }, []);

  const saveSamsaraNote = useCallback(async () => {
    if (!selectedSamsara) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/samsara/${selectedSamsara.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: samsaraNoteDraft || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Save failed: ${body.error ?? res.status}`);
        return;
      }
      setSelectedSamsara({ ...selectedSamsara, notes: samsaraNoteDraft || null });
      router.refresh();
    } finally {
      setSavingNote(false);
    }
  }, [selectedSamsara, samsaraNoteDraft, router]);

  const colorFor = (statusKey: string): string =>
    statusByKey.get(statusKey)?.color ?? UNKNOWN_STATUS_COLOR;
  const nameFor = (statusKey: string): string =>
    statusByKey.get(statusKey)?.name ?? statusKey;

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">
      {/* Filter sidebar */}
      <div className="w-56 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Filters</h3>

        {/* Status filter */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="all">All Statuses</option>
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Location filter */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Location</label>
          <select
            value={yardFilter}
            onChange={(e) => setYardFilter(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="all">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="border-t border-gray-200 pt-3 mt-2">
          <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Legend</label>
          <div className="space-y-1.5">
            {statuses.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-gray-600">{s.name}</span>
              </div>
            ))}
          </div>

          <label className="text-xs font-medium text-gray-500 uppercase mt-3 mb-2 block">GPS Source</label>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-700 flex-shrink-0" />
              <span className="text-xs text-gray-600">Cat VisionLink</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-gray-700 flex-shrink-0" />
              <span className="text-xs text-gray-600">Samsara</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: SAMSARA_UNLINKED_GRAY }} />
              <span className="text-xs text-gray-600">Samsara (unlinked)</span>
            </div>
          </div>
        </div>

        {/* Count */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-900">{units.length}</span> of {fleet.length} units
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden shadow-sm border border-gray-200">
        {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 text-center p-8">
            <div className="max-w-md">
              <p className="text-sm font-medium text-gray-700 mb-2">Map tiles not configured</p>
              <p className="text-xs text-gray-500">
                Set <code className="px-1.5 py-0.5 bg-gray-200 rounded text-[11px]">NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code className="px-1.5 py-0.5 bg-gray-200 rounded text-[11px]">.env.local</code> (or Vercel env vars) with a Mapbox public token (<code className="px-1.5 py-0.5 bg-gray-200 rounded text-[11px]">pk.*</code>) and restart the dev server to enable the fleet map.
              </p>
              <p className="mt-3 text-xs text-gray-400">
                Showing <span className="font-semibold text-gray-600">{units.length}</span> of {fleet.length} units (table view available in the Fleet tab).
              </p>
            </div>
          </div>
        ) : (
        <MapboxMap
          initialViewState={{
            latitude: 33.5,
            longitude: -99.0,
            zoom: 5.5,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        >
          <NavigationControl position="top-right" />

          {units.map((unit) => (
            <Marker
              key={unit.id}
              latitude={unit.lat}
              longitude={unit.lng}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(unit);
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white cursor-pointer shadow-md hover:scale-125 transition-transform"
                style={{ backgroundColor: colorFor(unit.status) }}
                title={`${unit.gl_code} — ${unit.equipment_name}`}
              />
            </Marker>
          ))}

          {samsaraMarkers.map((m) => (
            <Marker
              key={`samsara-${m.id}`}
              latitude={m.lat}
              longitude={m.lng}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleSamsaraClick(m);
              }}
            >
              <div
                className="w-4 h-4 border-2 border-white cursor-pointer shadow-md hover:scale-125 transition-transform"
                style={{
                  backgroundColor: m.equipment
                    ? colorFor(m.equipment.status)
                    : SAMSARA_UNLINKED_GRAY,
                  borderRadius: 0,
                }}
                title={`Samsara ${m.gateway_serial ?? m.samsara_name ?? m.samsara_id}${m.notes ? " — " + m.notes : ""}`}
              />
            </Marker>
          ))}

          {selected && (
            <Popup
              latitude={selected.lat}
              longitude={selected.lng}
              anchor="bottom"
              onClose={() => setSelected(null)}
              closeOnClick={false}
              className="fleet-popup"
            >
              <div className="p-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: colorFor(selected.status) }}
                  />
                  <span className="font-mono text-xs font-bold text-gray-800">{selected.gl_code}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{selected.equipment_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{selected.category_name}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="font-medium">{nameFor(selected.status)}</span>
                  </div>
                  {selected.customer_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Customer</span>
                      <span className="font-medium">{selected.customer_name}</span>
                    </div>
                  )}
                  {selected.hasGps ? (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Location</span>
                      <span className="font-medium text-green-600">GPS Live</span>
                    </div>
                  ) : selected.current_address ? (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Location</span>
                      <span className="font-medium text-right max-w-[140px]">{selected.current_address}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Yard</span>
                      <span className="font-medium">{selected.home_location_name ?? "Unknown"}</span>
                    </div>
                  )}
                </div>
                <a
                  href={`/fleet/${selected.id}`}
                  className="block mt-2 text-xs text-center text-brand-600 hover:text-brand-800 font-medium"
                >
                  View Details &rarr;
                </a>
              </div>
            </Popup>
          )}

          {selectedSamsara && (
            <Popup
              latitude={selectedSamsara.lat}
              longitude={selectedSamsara.lng}
              anchor="bottom"
              onClose={() => setSelectedSamsara(null)}
              closeOnClick={false}
              className="fleet-popup"
            >
              <div className="p-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5"
                    style={{
                      backgroundColor: selectedSamsara.equipment
                        ? colorFor(selectedSamsara.equipment.status)
                        : SAMSARA_UNLINKED_GRAY,
                    }}
                  />
                  <span className="font-mono text-xs font-bold text-gray-800">
                    {selectedSamsara.gateway_serial ?? selectedSamsara.samsara_name ?? selectedSamsara.samsara_id}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 ml-auto">
                    Samsara
                  </span>
                </div>
                {selectedSamsara.gateway_serial && selectedSamsara.samsara_name && (
                  <p className="text-[11px] text-gray-500 -mt-0.5 mb-1">
                    {selectedSamsara.samsara_name}
                  </p>
                )}

                {selectedSamsara.equipment ? (
                  <>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedSamsara.equipment.gl_code} — {selectedSamsara.equipment.equipment_name}
                    </p>
                    <div className="mt-1 flex justify-between text-xs">
                      <span className="text-gray-500">Status</span>
                      <span className="font-medium">{nameFor(selectedSamsara.equipment.status)}</span>
                    </div>
                    <a
                      href={`/fleet/${selectedSamsara.equipment.id}`}
                      className="block mt-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
                    >
                      View equipment &rarr;
                    </a>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 italic">Not linked to any equipment</p>
                )}

                <div className="mt-2">
                  <label className="text-xs text-gray-500 block mb-1">Notes</label>
                  <textarea
                    value={samsaraNoteDraft}
                    onChange={(e) => setSamsaraNoteDraft(e.target.value)}
                    rows={2}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                    placeholder="On 08-1234, customer XYZ — or — battery dead"
                  />
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={saveSamsaraNote}
                      disabled={savingNote || (samsaraNoteDraft === (selectedSamsara.notes ?? ""))}
                      className="text-xs bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white px-2 py-0.5 rounded"
                    >
                      {savingNote ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                {selectedSamsara.gpsTimestamp && (
                  <p className="mt-2 text-[10px] text-gray-400">
                    Last seen: {new Date(selectedSamsara.gpsTimestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </Popup>
          )}
        </MapboxMap>
        )}
      </div>
    </div>
  );
}
