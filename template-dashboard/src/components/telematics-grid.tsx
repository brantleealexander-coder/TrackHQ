"use client";

import { useState } from "react";
import StatCard from "@/components/stat-card";
import type { TelematicsAsset } from "@/lib/visionlink";

interface TelematicsGridProps {
  assets: TelematicsAsset[];
  fetchedAt: string;
}

const severityColors: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  Warning: "bg-amber-100 text-amber-800",
  Info: "bg-blue-100 text-blue-800",
};

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return ts; }
}

export default function TelematicsGrid({ assets, fetchedAt }: TelematicsGridProps) {
  const [filter, setFilter] = useState<"all" | "faults" | "idle">("all");

  const totalHours = assets.reduce((s, a) => s + (a.cumulativeHours ?? 0), 0);
  const totalIdleHours = assets.reduce((s, a) => s + (a.idleHours ?? 0), 0);
  const assetsWithFaults = assets.filter((a) => a.faultCodes.length > 0);
  const totalFaults = assets.reduce((s, a) => s + a.faultCodes.length, 0);
  const avgFuel = assets.filter((a) => a.fuelRemainingPercent !== null).length > 0
    ? Math.round(assets.reduce((s, a) => s + (a.fuelRemainingPercent ?? 0), 0) / assets.filter((a) => a.fuelRemainingPercent !== null).length)
    : null;

  const avgUtilization = totalHours > 0
    ? Math.round(((totalHours - totalIdleHours) / totalHours) * 100)
    : null;

  const filtered = filter === "all"
    ? assets
    : filter === "faults"
    ? assetsWithFaults
    : assets.filter((a) => a.idleHours && a.cumulativeHours && (a.idleHours / a.cumulativeHours) > 0.5);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Active Fault Codes"
          value={totalFaults}
          accent="red"
          sub={`${assetsWithFaults.length} units affected`}
        />
        <StatCard
          label="Fleet Engine Hours"
          value={Math.round(totalHours).toLocaleString()}
          accent="blue"
          sub={`${assets.length} units reporting`}
        />
        <StatCard
          label="Avg Utilization"
          value={avgUtilization !== null ? `${avgUtilization}%` : "—"}
          accent="green"
          sub="Working vs idle"
        />
        <StatCard
          label={avgFuel !== null ? "Avg Fuel Level" : "Last Sync"}
          value={avgFuel !== null ? `${avgFuel}%` : formatDate(fetchedAt)}
          accent={avgFuel !== null ? "amber" : "gray"}
        />
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Equipment Telematics</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { id: "all", label: "All" },
            { id: "faults", label: "With Faults" },
            { id: "idle", label: "High Idle" },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Telematics table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Make / Model</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Engine Hrs</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Idle Hrs</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilization</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fuel</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">DEF</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Faults</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Comm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                  No equipment data available
                </td>
              </tr>
            ) : (
              filtered.map((asset, i) => {
                const utilization = asset.cumulativeHours && asset.idleHours
                  ? Math.round(((asset.cumulativeHours - asset.idleHours) / asset.cumulativeHours) * 100)
                  : null;
                return (
                  <tr key={asset.serialNumber || i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono font-semibold text-gray-900">{asset.equipmentId || asset.serialNumber}</div>
                      <div className="text-xs text-gray-400">{asset.serialNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{asset.make} {asset.model}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                      {asset.cumulativeHours ? Math.round(asset.cumulativeHours).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-gray-500">
                      {asset.idleHours ? Math.round(asset.idleHours).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {utilization !== null ? (
                        <span className={utilization >= 70 ? "text-green-600" : utilization >= 40 ? "text-amber-600" : "text-red-600"}>
                          {utilization}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {asset.fuelRemainingPercent !== null ? (
                        <span className={asset.fuelRemainingPercent > 25 ? "text-gray-900" : "text-red-600 font-semibold"}>
                          {asset.fuelRemainingPercent}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {asset.defRemainingPercent !== null ? (
                        <span className={asset.defRemainingPercent > 25 ? "text-gray-900" : "text-red-600 font-semibold"}>
                          {asset.defRemainingPercent}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {asset.faultCodes.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {asset.faultCodes.length}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(asset.lastCommunication)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Fault codes section */}
      {assetsWithFaults.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Active Fault Codes</h3>
          <div className="space-y-3">
            {assetsWithFaults.map((asset, i) => (
              <div key={asset.serialNumber || i} className="bg-white rounded-xl shadow-sm border border-red-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-sm font-semibold text-gray-900">
                    {asset.equipmentId || asset.serialNumber} — {asset.make} {asset.model}
                  </span>
                  <span className="text-xs text-red-600 font-medium">
                    {asset.faultCodes.length} active fault{asset.faultCodes.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {asset.faultCodes.map((fault, fi) => (
                    <div key={fi} className="flex items-start gap-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors[fault.severity] ?? severityColors.Warning}`}>
                        {fault.severity}
                      </span>
                      <div className="flex-1">
                        <span className="font-mono text-gray-500 text-xs">SPN {fault.spn} / FMI {fault.fmi}</span>
                        <p className="text-gray-700">{fault.description}</p>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(fault.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
