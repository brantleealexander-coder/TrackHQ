"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SamsaraDeviceWithEquipment } from "@/lib/types";

interface EquipmentOption {
  id: number;
  gl_code: string;
  equipment_name: string;
}

interface Props {
  devices: SamsaraDeviceWithEquipment[];
  equipmentOptions: EquipmentOption[];
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} hr ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function SamsaraDevicesTable({ devices, equipmentOptions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({});

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/samsara/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setSyncMsg(`Sync failed: ${body.error ?? res.status}`);
      } else {
        const parts = [
          `Synced ${body.upserted} device${body.upserted === 1 ? "" : "s"}`,
          body.serialsResolved != null ? `${body.serialsResolved} serial${body.serialsResolved === 1 ? "" : "s"} resolved` : null,
          body.skipped ? `${body.skipped} skipped` : null,
        ].filter(Boolean);
        setSyncMsg(`${parts.join(", ")}.${body.warning ? " " + body.warning : ""}`);
        startTransition(() => router.refresh());
      }
    } catch (err: any) {
      setSyncMsg(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function patchDevice(id: number, patch: Record<string, unknown>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/samsara/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Save failed: ${body.error ?? res.status}`);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          {syncing ? "Syncing..." : "Sync from Samsara"}
        </button>
        {syncMsg && <span className="text-sm text-gray-600">{syncMsg}</span>}
        {pending && <span className="text-xs text-gray-400">Refreshing...</span>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Gateway Serial</th>
              <th className="text-left px-4 py-3">Samsara Name</th>
              <th className="text-left px-4 py-3">Active</th>
              <th className="text-left px-4 py-3">Linked Equipment</th>
              <th className="text-left px-4 py-3">Notes</th>
              <th className="text-left px-4 py-3">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No Samsara devices yet. Click <strong>Sync from Samsara</strong> to load them.
                </td>
              </tr>
            )}
            {devices.map((d) => {
              const draft = drafts[d.id];
              const noteValue = draft ?? d.notes ?? "";
              const dirty = draft !== undefined && draft !== (d.notes ?? "");

              const nameDraft = nameDrafts[d.id];
              const nameValue = nameDraft ?? d.samsara_name ?? "";
              const nameDirty =
                nameDraft !== undefined && nameDraft !== (d.samsara_name ?? "");

              return (
                <tr key={d.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-gray-800">
                    {d.gateway_serial ?? <span className="text-gray-400 font-normal">—</span>}
                  </td>

                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) =>
                        setNameDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      placeholder="—"
                      className="text-xs text-gray-700 border border-gray-200 rounded-md px-2 py-1 w-56"
                    />
                    {nameDirty && (
                      <div className="mt-1 flex gap-2">
                        <button
                          onClick={() => {
                            patchDevice(d.id, { samsara_name: nameDraft || null });
                            setNameDrafts((prev) => {
                              const next = { ...prev };
                              delete next[d.id];
                              return next;
                            });
                          }}
                          disabled={savingId === d.id}
                          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() =>
                            setNameDrafts((prev) => {
                              const next = { ...prev };
                              delete next[d.id];
                              return next;
                            })
                          }
                          className="text-xs text-gray-500 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.is_active}
                        disabled={savingId === d.id}
                        onChange={(e) => patchDevice(d.id, { is_active: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className={d.is_active ? "text-green-700" : "text-gray-400"}>
                        {d.is_active ? "Active" : "Inoperable"}
                      </span>
                    </label>
                  </td>

                  <td className="px-4 py-3">
                    <select
                      value={d.equipment_id ?? ""}
                      disabled={savingId === d.id}
                      onChange={(e) =>
                        patchDevice(d.id, {
                          equipment_id: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="text-sm border border-gray-200 rounded-md px-2 py-1 max-w-[260px]"
                    >
                      <option value="">— unlinked —</option>
                      {equipmentOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.gl_code} — {opt.equipment_name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3">
                    <textarea
                      value={noteValue}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      rows={2}
                      className="w-72 text-sm border border-gray-200 rounded-md px-2 py-1"
                      placeholder="On 08-1234, customer XYZ — or — battery dead"
                    />
                    {dirty && (
                      <div className="mt-1 flex gap-2">
                        <button
                          onClick={() => {
                            patchDevice(d.id, { notes: draft || null });
                            setDrafts((prev) => {
                              const next = { ...prev };
                              delete next[d.id];
                              return next;
                            });
                          }}
                          disabled={savingId === d.id}
                          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() =>
                            setDrafts((prev) => {
                              const next = { ...prev };
                              delete next[d.id];
                              return next;
                            })
                          }
                          className="text-xs text-gray-500 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-500">
                    {relativeTime(d.last_seen_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
