"use client";

import { useState } from "react";

export type LeadKind = "demo" | "contact";

interface Props {
  kind: LeadKind;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  business_name: string;
  rental_type: string;
  current_software: string;
  message: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  business_name: "",
  rental_type: "",
  current_software: "",
  message: "",
};

export default function ContactForm({ kind }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, ...form }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `request failed (${res.status})`);
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-brand-600"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Thanks — we got it.</h2>
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ll be in touch at <span className="font-medium text-gray-900">{form.email}</span> within one business day.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Name" required value={form.name} onChange={(v) => update("name", v)} autoComplete="name" />
        <Field label="Business" required value={form.business_name} onChange={(v) => update("business_name", v)} autoComplete="organization" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Email" required type="email" value={form.email} onChange={(v) => update("email", v)} autoComplete="email" />
        <Field label="Phone" type="tel" value={form.phone} onChange={(v) => update("phone", v)} autoComplete="tel" />
      </div>
      <Field
        label="What do you rent?"
        placeholder="e.g. heavy equipment, cargo vans, jet skis, event tents"
        value={form.rental_type}
        onChange={(v) => update("rental_type", v)}
      />
      <Field
        label="Current software (if any)"
        placeholder="e.g. Booqable, Point of Rental, spreadsheets, in-house tool"
        value={form.current_software}
        onChange={(v) => update("current_software", v)}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700">Anything specific you want covered?</label>
        <textarea
          rows={4}
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder={kind === "demo" ? "Optional. What would make the demo most useful?" : "Optional."}
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gray-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50 md:w-auto"
      >
        {status === "submitting"
          ? "Submitting…"
          : kind === "demo"
            ? "Request demo →"
            : "Send message →"}
      </button>
      <p className="text-xs text-gray-500">
        By submitting, you agree to receive a follow-up from our sales team. We don&apos;t share your info.
      </p>
    </form>
  );
}

function Field({
  label,
  required = false,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
