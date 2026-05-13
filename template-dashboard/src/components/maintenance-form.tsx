"use client";

import { useState } from "react";

interface EquipmentOption {
  id: number;
  gl_code: string;
  equipment_name: string;
  division_id: number;
  divisions: { name: string } | null;
}

interface MaintenanceFormProps {
  equipment: EquipmentOption[];
}

const CATEGORIES = [
  "Preventive",
  "Repair",
  "Tires",
  "Engine",
  "Hydraulics",
  "Electrical",
  "Other",
];

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export default function MaintenanceForm({ equipment }: MaintenanceFormProps) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [date, setDate] = useState(today());
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("Repair");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Group by division for dropdown
  const byDivision = new Map<string, EquipmentOption[]>();
  for (const eq of equipment) {
    const div = eq.divisions?.name ?? `Division ${eq.division_id}`;
    if (!byDivision.has(div)) byDivision.set(div, []);
    byDivision.get(div)!.push(eq);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment_id: selectedId,
        date,
        cost: parseFloat(cost) || 0,
        description,
        vendor: vendor || null,
        category,
        invoice_number: invoiceNumber || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
    } else {
      const eq = equipment.find((e) => e.id === selectedId);
      setSuccess(
        `Logged: ${eq?.gl_code} — ${eq?.equipment_name} · ${category} · $${parseFloat(cost).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      );
      setSelectedId("");
      setDate(today());
      setCost("");
      setDescription("");
      setVendor("");
      setCategory("Repair");
      setInvoiceNumber("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8 space-y-6 max-w-2xl">
      {/* Equipment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Equipment <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(Number(e.target.value) || "")}
          required
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
        >
          <option value="">— Select equipment —</option>
          {[...byDivision.entries()].sort().map(([divName, items]) => (
            <optgroup key={divName} label={divName}>
              {items.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.gl_code} — {eq.equipment_name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Date + Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cost */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Cost ($) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          required
          min={0}
          step="0.01"
          placeholder="0.00"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Description <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="e.g. Oil change and filter replacement"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Vendor + Invoice */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Vendor / Mechanic
          </label>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="e.g. Joe's Diesel Repair"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Invoice / Work Order #
          </label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="e.g. INV-2024-0042"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

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
        type="submit"
        disabled={loading || !selectedId}
        className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading ? "Saving…" : "Log Maintenance"}
      </button>
    </form>
  );
}
