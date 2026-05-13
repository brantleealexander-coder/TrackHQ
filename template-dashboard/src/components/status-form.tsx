"use client";

import { useState } from "react";
import type { EquipmentStatus, RateType } from "@/lib/types";

interface EquipmentOption {
  id: number;
  gl_code: string;
  equipment_name: string;
  division_id: number;
  divisions: { name: string } | null;
}

const STATUS_OPTIONS: EquipmentStatus[] = [
  "ON RENT",
  "AVAILABLE",
  "DOWN",
  "RESERVED",
  "IN SERVICE",
  "OFF RENT PENDING",
];

const RATE_OPTIONS: RateType[] = ["daily", "weekly", "monthly"];

interface StatusFormProps {
  equipment: EquipmentOption[];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export default function StatusForm({ equipment }: StatusFormProps) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [status, setStatus] = useState<EquipmentStatus>("AVAILABLE");
  const [customerName, setCustomerName] = useState("");
  const [jobPo, setJobPo] = useState("");
  const [rateType, setRateType] = useState<RateType>("monthly");
  const [rentalStart, setRentalStart] = useState(today());
  const [rentalEnd, setRentalEnd] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const showCustomer = status === "ON RENT" || status === "RESERVED";
  const showRentalFields = status === "ON RENT";
  const showRentalEnd = status === "ON RENT" || status === "OFF RENT PENDING";

  // Group equipment by division for the dropdown
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

    const payload: Record<string, unknown> = {
      status,
      customer_name: showCustomer ? customerName || null : null,
      job_po_notes: jobPo || null,
      rate_type: showRentalFields ? rateType : null,
      rental_start: showRentalFields ? rentalStart || null : null,
      rental_end: showRentalEnd ? rentalEnd || null : null,
      location: showRentalFields ? location || null : null,
    };

    const res = await fetch(`/api/equipment/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
    } else {
      const eq = equipment.find((e) => e.id === selectedId);
      setSuccess(
        `Updated: ${eq?.gl_code} — ${eq?.equipment_name} → ${status}` +
          (data.revenue_amount
            ? ` ($${data.revenue_amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} revenue recorded)`
            : "")
      );
      // Reset form
      setSelectedId("");
      setStatus("AVAILABLE");
      setCustomerName("");
      setJobPo("");
      setRateType("monthly");
      setRentalStart(today());
      setRentalEnd("");
      setLocation("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8 space-y-6 max-w-2xl">
      {/* Equipment selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Equipment <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(Number(e.target.value) || "")}
          required
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          New Status <span className="text-red-500">*</span>
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
          required
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Customer */}
      {showCustomer && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Customer Name{status === "ON RENT" && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required={status === "ON RENT"}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Customer or company name"
          />
        </div>
      )}

      {/* Job / PO / Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Job / PO / Notes
        </label>
        <input
          type="text"
          value={jobPo}
          onChange={(e) => setJobPo(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Job number, PO, or notes"
        />
      </div>

      {/* Rental fields */}
      {showRentalFields && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Rate Type <span className="text-red-500">*</span>
            </label>
            <select
              value={rateType}
              onChange={(e) => setRateType(e.target.value as RateType)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize"
            >
              {RATE_OPTIONS.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Rental Start <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={rentalStart}
              onChange={(e) => setRentalStart(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Rental end */}
      {showRentalEnd && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Expected Return Date
          </label>
          <input
            type="date"
            value={rentalEnd}
            onChange={(e) => setRentalEnd(e.target.value)}
            min={rentalStart || undefined}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Equipment Location (for non-VisionLink units) */}
      {showRentalFields && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Equipment Location{" "}
            <span className="text-gray-400 font-normal">(only required if VisionLink is not installed)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Job site address (e.g. 1234 Main St, Midland, TX 79701)"
          />
          <p className="text-xs text-gray-400 mt-1">
            This address will be used to show the unit on the Fleet Map. VisionLink GPS will override this when available.
          </p>
        </div>
      )}

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
        disabled={loading || !selectedId}
        className="w-full py-2.5 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading ? "Saving…" : "Save Status Update"}
      </button>
    </form>
  );
}
