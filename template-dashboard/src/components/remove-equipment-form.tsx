"use client";

import { useState } from "react";

interface EquipmentOption {
  id: number;
  gl_code: string;
  equipment_name: string;
  category_id: number;
  categories: { name: string } | null;
}

interface RemoveEquipmentFormProps {
  equipment: EquipmentOption[];
}

export default function RemoveEquipmentForm({ equipment }: RemoveEquipmentFormProps) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const selected = equipment.find((e) => e.id === selectedId);

  // Group by category for dropdown
  const byCategory = new Map<string, EquipmentOption[]>();
  for (const eq of equipment) {
    const cat = eq.categories?.name ?? `Category ${eq.category_id}`;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(eq);
  }

  async function handleRemove() {
    if (!selectedId || !confirmed) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/equipment/${selectedId}`, { method: "DELETE" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
    } else {
      setSuccess(`Removed: ${data.gl_code} — ${data.equipment_name}`);
      setSelectedId("");
      setConfirmed(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Equipment to Remove <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(Number(e.target.value) || "");
            setConfirmed(false);
            setError("");
            setSuccess("");
          }}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
        >
          <option value="">— Select equipment —</option>
          {[...byCategory.entries()].sort().map(([catName, items]) => (
            <optgroup key={catName} label={catName}>
              {items.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.gl_code} — {eq.equipment_name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selected && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold mb-1">This will permanently delete:</p>
          <p>{selected.gl_code} — {selected.equipment_name}</p>
          <p className="mt-2 text-xs text-red-600">All rental history for this unit will also be removed.</p>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-4 h-4 accent-red-500"
            />
            <span className="font-medium">Yes, permanently remove this unit</span>
          </label>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        onClick={handleRemove}
        disabled={loading || !selectedId || !confirmed}
        className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading ? "Removing…" : "Remove Equipment"}
      </button>
    </div>
  );
}
