"use client";

import { useState } from "react";

const DIVISIONS = [
  { id: 1, name: "Dozers" },
  { id: 2, name: "Articulating Trucks" },
  { id: 3, name: "Excavators" },
  { id: 4, name: "Mini Excavators" },
  { id: 5, name: "Compactor" },
  { id: 6, name: "Wheel Loaders" },
  { id: 7, name: "Backhoe Loader" },
  { id: 8, name: "Skid Steer" },
  { id: 9, name: "Screeners" },
  { id: 10, name: "Telehandler" },
  { id: 11, name: "Lifts" },
  { id: 12, name: "Trailers" },
  { id: 13, name: "Grader" },
  { id: 14, name: "Attachments" },
  { id: 15, name: "Landscape" },
  { id: 16, name: "Concrete Equipment" },
  { id: 17, name: "Misc" },
  { id: 18, name: "Water Trucks" },
  { id: 19, name: "Specialty Equipment" },
];

export default function AddEquipmentForm() {
  const [glCode, setGlCode] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [divisionId, setDivisionId] = useState<number | "">("");
  const [year, setYear] = useState("");
  const [rateDaily, setRateDaily] = useState("");
  const [rateWeekly, setRateWeekly] = useState("");
  const [rateMonthly, setRateMonthly] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [homeYard, setHomeYard] = useState("");
  const [isCrossCharge, setIsCrossCharge] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gl_code: glCode,
        equipment_name: equipmentName,
        division_id: divisionId,
        year: year || null,
        rate_daily: rateDaily || null,
        rate_weekly: rateWeekly || null,
        rate_monthly: rateMonthly || null,
        serial_number: serialNumber || null,
        home_yard: homeYard || null,
        is_cross_charge: isCrossCharge,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
    } else {
      setSuccess(`Added: ${glCode.toUpperCase()} — ${equipmentName} (status set to AVAILABLE)`);
      setGlCode("");
      setEquipmentName("");
      setDivisionId("");
      setYear("");
      setRateDaily("");
      setRateWeekly("");
      setRateMonthly("");
      setSerialNumber("");
      setHomeYard("");
      setIsCrossCharge(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8 space-y-6 max-w-2xl">
      {/* GL Code + Equipment Name */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            GL Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={glCode}
            onChange={(e) => setGlCode(e.target.value)}
            required
            placeholder="e.g. 01-0175"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2022"
            min={1980}
            max={2100}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Equipment Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={equipmentName}
          onChange={(e) => setEquipmentName(e.target.value)}
          required
          placeholder="e.g. Komatsu D65PX Dozer"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Serial Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Serial Number
        </label>
        <input
          type="text"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          placeholder="e.g. ZJB00162"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase"
        />
      </div>

      {/* Division */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Division <span className="text-red-500">*</span>
        </label>
        <select
          value={divisionId}
          onChange={(e) => setDivisionId(Number(e.target.value) || "")}
          required
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
        >
          <option value="">— Select division —</option>
          {DIVISIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id.toString().padStart(2, "0")} — {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Rate ($)</label>
          <input
            type="number"
            value={rateDaily}
            onChange={(e) => setRateDaily(e.target.value)}
            min={0}
            step="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Weekly Rate ($)</label>
          <input
            type="number"
            value={rateWeekly}
            onChange={(e) => setRateWeekly(e.target.value)}
            min={0}
            step="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Rate ($)</label>
          <input
            type="number"
            value={rateMonthly}
            onChange={(e) => setRateMonthly(e.target.value)}
            min={0}
            step="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Home Yard + Cross Charge */}
      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Home Yard</label>
          <input
            type="text"
            value={homeYard}
            onChange={(e) => setHomeYard(e.target.value)}
            placeholder="e.g. Dallas"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex items-center gap-2 pb-2.5">
          <input
            id="cross-charge"
            type="checkbox"
            checked={isCrossCharge}
            onChange={(e) => setIsCrossCharge(e.target.checked)}
            className="w-4 h-4 accent-orange-500"
          />
          <label htmlFor="cross-charge" className="text-sm font-medium text-gray-700">
            Cross Charge Unit
          </label>
        </div>
      </div>

      {/* Feedback */}
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
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading ? "Adding…" : "Add Equipment"}
      </button>
    </form>
  );
}
