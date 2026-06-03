"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerProfile } from "@/lib/customer-detail-queries";

export default function CustomerContactForm({ customer }: { customer: CustomerProfile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    company: customer.company ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<"idle" | "ok" | "err">("idle");

  async function save() {
    setSaving(true);
    setSaved("idle");
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (res.ok) {
        setSaved("ok");
        router.refresh();
      } else {
        setSaved("err");
      }
    } catch {
      setSaved("err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      </div>
      <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Notes</span>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Preferred delivery times, special needs, internal notes…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !form.name.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved === "ok" && <span className="text-xs text-emerald-600">Saved.</span>}
        {saved === "err" && <span className="text-xs text-red-600">Save failed.</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
