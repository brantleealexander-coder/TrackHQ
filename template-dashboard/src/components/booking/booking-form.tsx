"use client";

import { useMemo, useState } from "react";
import type { CatalogUnit } from "@/lib/booking-queries";

interface BookingFormProps {
  slug: string;
  unit: CatalogUnit;
  customerName: string;
}

function fmt(n: number | null): string | null {
  if (n == null) return null;
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function diffDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const a = new Date(start + "T00:00:00").getTime();
  const b = new Date(end + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

type RateType = "daily" | "weekly" | "monthly";

export default function BookingForm({ slug, unit, customerName }: BookingFormProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rateType, setRateType] = useState<RateType | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => diffDays(start, end), [start, end]);

  // Auto-pick the cheapest/most-appropriate rate type for the duration.
  const autoRate: RateType | null = useMemo(() => {
    if (days <= 0) return null;
    if (days >= 28 && unit.rate_monthly != null) return "monthly";
    if (days >= 7 && unit.rate_weekly != null) return "weekly";
    if (unit.rate_daily != null) return "daily";
    if (unit.rate_weekly != null) return "weekly";
    if (unit.rate_monthly != null) return "monthly";
    return null;
  }, [days, unit]);

  const effectiveRate: RateType | null = (rateType || autoRate) as RateType | null;

  const estimate: number | null = useMemo(() => {
    if (!effectiveRate || days <= 0) return null;
    if (effectiveRate === "daily" && unit.rate_daily != null) return unit.rate_daily * days;
    if (effectiveRate === "weekly" && unit.rate_weekly != null) return unit.rate_weekly * Math.max(1, Math.ceil(days / 7));
    if (effectiveRate === "monthly" && unit.rate_monthly != null) return unit.rate_monthly * Math.max(1, Math.ceil(days / 28));
    return null;
  }, [effectiveRate, days, unit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !start || !end) {
      setError("Please fill in name, email, and both dates.");
      return;
    }
    if (diffDays(start, end) <= 0) {
      setError("End date must be after start date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/book/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: unit.id,
          renter_name: name.trim(),
          renter_email: email.trim(),
          renter_phone: phone.trim() || null,
          rental_start: start,
          rental_end: end,
          rate_type: effectiveRate,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Submission failed. Please try again.");
        return;
      }
      setConfirmation(json.booking_id ?? 0);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation !== null) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8">
        <div className="flex items-start gap-4">
          <span aria-hidden className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
            ✓
          </span>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Request received</h2>
            <p className="mt-2 text-sm text-gray-700">
              Thanks, {name}. {customerName} will email <span className="font-medium">{email}</span> to confirm your booking for <span className="font-medium">{unit.equipment_name}</span> from {start} to {end}.
            </p>
            <p className="mt-3 text-xs text-gray-500">
              Reference #{String(confirmation).padStart(6, "0")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Request this booking</h2>
        <p className="mt-1 text-xs text-gray-500">
          {customerName} confirms each request manually — no card needed yet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Your name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Field>
      </div>

      <Field label="Phone (optional)">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start date" required>
          <input
            type="date"
            min={today}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Field>
        <Field label="End date" required>
          <input
            type="date"
            min={start || today}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Field>
      </div>

      <Field label="Rate">
        <select
          value={rateType}
          onChange={(e) => setRateType(e.target.value as RateType | "")}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Auto ({autoRate ?? "—"})</option>
          {unit.rate_daily != null && <option value="daily">Daily ({fmt(unit.rate_daily)})</option>}
          {unit.rate_weekly != null && <option value="weekly">Weekly ({fmt(unit.rate_weekly)})</option>}
          {unit.rate_monthly != null && <option value="monthly">Monthly ({fmt(unit.rate_monthly)})</option>}
        </select>
      </Field>

      <Field label="Notes (optional)">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Job site, delivery address, anything we should know"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </Field>

      {estimate != null && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Estimate · {effectiveRate}
            </p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">
              {fmt(estimate)}
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {days} day{days === 1 ? "" : "s"} · final total confirmed by {customerName}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit booking request"}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
