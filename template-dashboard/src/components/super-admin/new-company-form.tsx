"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewCompanyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [brand, setBrand] = useState("#F37535");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !slug.trim() || !ownerEmail.trim()) {
      setError("Name, slug, and owner email are required.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/super-admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        slug: slug.trim(),
        brand_color: brand,
        owner_email: ownerEmail.trim().toLowerCase(),
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json?.error ?? "Could not create company.");
      return;
    }
    router.push("/super-admin/companies");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <Field label="Company name">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
          autoFocus
          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </Field>
      <Field
        label="URL slug"
        help="Used in /book/<slug>. Lowercase, hyphenated, unique."
      >
        <input
          value={slug}
          onChange={(e) => {
            setSlug(slugify(e.target.value));
            setSlugTouched(true);
          }}
          required
          pattern="[a-z0-9-]+"
          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </Field>
      <Field label="Brand color">
        <div className="mt-1.5 flex items-center gap-3">
          <input
            type="color"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-md border border-gray-200 bg-white"
          />
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            pattern="#[A-Fa-f0-9]{6}"
            className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </Field>
      <Field
        label="Owner email"
        help="They'll receive a Supabase invite link to set their password."
      >
        <input
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          required
          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </Field>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 px-5 text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create + invite owner"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </label>
  );
}
