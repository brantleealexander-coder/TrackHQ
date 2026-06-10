"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerRow } from "@/lib/customer-queries";
import type { AvailableAsset } from "@/lib/available-assets";
import { getTenantConfig } from "@/lib/tenant-config";

type RateType = "daily" | "weekly" | "monthly";

interface NewOrderFormProps {
  assets: AvailableAsset[];
}

interface LineItem {
  asset: AvailableAsset;
  rate_type: RateType;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function diffDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const a = new Date(start + "T00:00:00").getTime();
  const b = new Date(end + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}

function pickRate(asset: AvailableAsset, rateType: RateType): number {
  if (rateType === "daily") return asset.rate_daily ?? 0;
  if (rateType === "weekly") return asset.rate_weekly ?? 0;
  return asset.rate_monthly ?? 0;
}

function lineTotal(asset: AvailableAsset, rateType: RateType, days: number): number {
  if (days <= 0) return 0;
  const rate = pickRate(asset, rateType);
  if (rate <= 0) return 0;
  if (rateType === "daily") return rate * days;
  if (rateType === "weekly") return rate * Math.max(1, Math.ceil(days / 7));
  return rate * Math.max(1, Math.ceil(days / 28));
}

function defaultRate(asset: AvailableAsset, days: number): RateType {
  if (days >= 28 && asset.rate_monthly != null) return "monthly";
  if (days >= 7 && asset.rate_weekly != null) return "weekly";
  if (asset.rate_daily != null) return "daily";
  if (asset.rate_weekly != null) return "weekly";
  return "monthly";
}

export default function NewOrderForm({ assets }: NewOrderFormProps) {
  const router = useRouter();
  const { terminology } = getTenantConfig();

  // Customer picker state
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", company: "" });

  // Dates
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState("");

  // Asset picker
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);

  // Misc
  const [notes, setNotes] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"upcoming" | "active">("upcoming");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => diffDays(start, end), [start, end]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inCart = new Set(lines.map((l) => l.asset.id));
    return assets.filter((a) => {
      if (inCart.has(a.id)) return false;
      if (!q) return true;
      return (
        a.equipment_name.toLowerCase().includes(q) ||
        a.gl_code.toLowerCase().includes(q) ||
        a.category_name.toLowerCase().includes(q)
      );
    });
  }, [assets, search, lines]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + lineTotal(l.asset, l.rate_type, days), 0),
    [lines, days]
  );

  async function searchCustomers(q: string) {
    setCustomerSearching(true);
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setCustomerResults((json?.customers as CustomerRow[]) ?? []);
    } finally {
      setCustomerSearching(false);
    }
  }

  function onCustomerQueryChange(q: string) {
    setCustomerQuery(q);
    setShowAddCustomer(false);
    if (q.trim().length === 0) {
      setCustomerResults([]);
      return;
    }
    searchCustomers(q);
  }

  function pickCustomer(c: CustomerRow) {
    setCustomer(c);
    setCustomerQuery("");
    setCustomerResults([]);
    setShowAddCustomer(false);
  }

  async function createNewCustomer() {
    setError(null);
    if (!newCustomer.name.trim()) {
      setError("Name is required.");
      return;
    }
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim() || null,
        phone: newCustomer.phone.trim() || null,
        company: newCustomer.company.trim() || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Could not create customer.");
      return;
    }
    pickCustomer({
      id: json.customer_id,
      name: newCustomer.name.trim(),
      email: newCustomer.email.trim() || null,
      phone: newCustomer.phone.trim() || null,
      company: newCustomer.company.trim() || null,
    });
    setNewCustomer({ name: "", email: "", phone: "", company: "" });
  }

  function addLine(asset: AvailableAsset) {
    setLines((ls) => [
      ...ls,
      { asset, rate_type: defaultRate(asset, days || 1) },
    ]);
  }

  function changeRate(equipmentId: number, rate: RateType) {
    setLines((ls) =>
      ls.map((l) => (l.asset.id === equipmentId ? { ...l, rate_type: rate } : l))
    );
  }

  function removeLine(equipmentId: number) {
    setLines((ls) => ls.filter((l) => l.asset.id !== equipmentId));
  }

  async function submit() {
    setError(null);
    if (!customer) {
      setError("Pick or add a customer first.");
      return;
    }
    if (!start || !end) {
      setError("Set both start and end dates.");
      return;
    }
    if (days <= 0) {
      setError("End date must be on or after start date.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one asset.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customer.id,
          rental_start: start,
          rental_end: end,
          notes: notes.trim() || null,
          status: submitStatus,
          lines: lines.map((l) => ({
            equipment_id: l.asset.id,
            rate_type: l.rate_type,
            rate_amount: pickRate(l.asset, l.rate_type),
            line_total: lineTotal(l.asset, l.rate_type, days),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not create order.");
        return;
      }
      router.push(`/app/orders/${json.order_id}`);
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      {/* Left column: form */}
      <div className="space-y-6 lg:col-span-3">
        {/* Customer */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Customer</h2>
          {customer ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
              <div>
                <p className="text-base font-semibold text-gray-900">{customer.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[customer.company, customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details on file"}
                </p>
              </div>
              <button
                onClick={() => setCustomer(null)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => onCustomerQueryChange(e.target.value)}
                  placeholder="Search customers by name, email, phone…"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {customerResults.length > 0 && !showAddCustomer && (
                  <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {customerResults.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => pickCustomer(c)}
                          className="w-full px-3.5 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {(c.email || c.phone) && (
                            <p className="text-xs text-gray-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {customerSearching && <p className="text-xs text-gray-400">Searching…</p>}

              <button
                onClick={() => setShowAddCustomer((s) => !s)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                {showAddCustomer ? "Cancel" : "+ Add new customer"}
              </button>

              {showAddCustomer && (
                <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/40 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input label="Name *" value={newCustomer.name} onChange={(v) => setNewCustomer({ ...newCustomer, name: v })} />
                    <Input label="Company" value={newCustomer.company} onChange={(v) => setNewCustomer({ ...newCustomer, company: v })} />
                    <Input label="Email" value={newCustomer.email} onChange={(v) => setNewCustomer({ ...newCustomer, email: v })} type="email" />
                    <Input label="Phone" value={newCustomer.phone} onChange={(v) => setNewCustomer({ ...newCustomer, phone: v })} type="tel" />
                  </div>
                  <button
                    onClick={createNewCustomer}
                    className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Save customer
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Dates */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Rental window</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Start date" type="date" value={start} onChange={setStart} />
            <Input label="End date" type="date" value={end} min={start} onChange={setEnd} />
          </div>
          {days > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              {days} day{days === 1 ? "" : "s"} total
            </p>
          )}
        </section>

        {/* Assets */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Add {terminology.asset_plural.toLowerCase()}</h2>
            <span className="text-xs tabular-nums text-gray-400">
              {filteredAssets.length} available
            </span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, GL code, or category…"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <ul className="mt-3 max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
            {filteredAssets.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-gray-400">
                No matching {terminology.asset_plural.toLowerCase()}.
              </li>
            ) : (
              filteredAssets.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => addLine(a)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-brand-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{a.equipment_name}</p>
                      <p className="truncate text-[11px] text-gray-500">
                        {a.gl_code} · {a.category_name}
                      </p>
                    </div>
                    <p className="flex-shrink-0 text-xs text-gray-500">
                      {a.rate_daily != null && `$${a.rate_daily}/d`}
                      {a.rate_daily == null && a.rate_weekly != null && `$${a.rate_weekly}/wk`}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Notes */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Notes</h2>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Job site, delivery info, special handling…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </section>
      </div>

      {/* Right column: cart + submit */}
      <aside className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Order summary</h2>

          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-3 py-6 text-center text-xs text-gray-500">
              No {terminology.asset_plural.toLowerCase()} added yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => {
                const lt = lineTotal(line.asset, line.rate_type, days);
                return (
                  <li key={line.asset.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {line.asset.equipment_name}
                        </p>
                        <p className="text-[11px] text-gray-500">{line.asset.gl_code}</p>
                      </div>
                      <button
                        onClick={() => removeLine(line.asset.id)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <select
                        value={line.rate_type}
                        onChange={(e) => changeRate(line.asset.id, e.target.value as RateType)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {line.asset.rate_daily != null && <option value="daily">Daily ${line.asset.rate_daily}</option>}
                        {line.asset.rate_weekly != null && <option value="weekly">Weekly ${line.asset.rate_weekly}</option>}
                        {line.asset.rate_monthly != null && <option value="monthly">Monthly ${line.asset.rate_monthly}</option>}
                      </select>
                      <p className="text-sm font-semibold tabular-nums text-gray-900">
                        ${Math.round(lt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total</p>
              <p className="text-xl font-bold tabular-nums text-gray-900">
                ${Math.round(total).toLocaleString()}
              </p>
            </div>
            {days > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Over {days} day{days === 1 ? "" : "s"} · {lines.length} {lines.length === 1 ? terminology.asset_singular.toLowerCase() : terminology.asset_plural.toLowerCase()}
              </p>
            )}
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Status on create</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSubmitStatus("upcoming")}
                className={
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors " +
                  (submitStatus === "upcoming"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50")
                }
              >
                Upcoming
              </button>
              <button
                onClick={() => setSubmitStatus("active")}
                className={
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors " +
                  (submitStatus === "active"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50")
                }
              >
                Active now
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">
              &quot;Active now&quot; flips each asset&apos;s status to on-rent immediately.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="mt-5 w-full rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
          >
            {submitting ? "Creating order…" : "Create order"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
