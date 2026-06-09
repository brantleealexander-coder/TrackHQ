"use client";

import { Fragment, useState } from "react";
import type { LeadRow, LeadStatus } from "@/lib/super-admin-queries";

interface LeadsTableProps {
  leads: LeadRow[];
}

const STATUSES: LeadStatus[] = ["new", "contacted", "converted", "declined"];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadge(s: LeadStatus): string {
  if (s === "new") return "bg-brand-50 text-brand-700";
  if (s === "contacted") return "bg-amber-50 text-amber-700";
  if (s === "converted") return "bg-emerald-50 text-emerald-700";
  return "bg-gray-100 text-gray-600";
}

export default function LeadsTable({ leads: initial }: LeadsTableProps) {
  const [leads, setLeads] = useState(initial);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function updateStatus(id: number, status: LeadStatus) {
    setLeads((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
    await fetch(`/api/super-admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-base font-medium text-gray-700">No leads yet.</p>
        <p className="mt-1 text-sm text-gray-500">
          Form submissions from trackhq.com/demo will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="bg-gray-50/80">
          <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-4 py-2.5">Submitted</th>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Business</th>
            <th className="px-4 py-2.5">Contact</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {leads.map((l) => (
            <Fragment key={l.id}>
              <tr
                onClick={() => setExpanded((id) => (id === l.id ? null : l.id))}
                className="cursor-pointer transition-colors hover:bg-gray-50/60"
              >
                <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(l.created_at)}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{l.name}</td>
                <td className="px-4 py-2.5 text-gray-700">{l.business_name}</td>
                <td className="px-4 py-2.5 text-gray-700">
                  <p>{l.email}</p>
                  {l.phone && <p className="text-xs text-gray-500">{l.phone}</p>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    l.kind === "demo" ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {l.kind}
                  </span>
                </td>
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={l.status}
                    onChange={(e) => updateStatus(l.id, e.target.value as LeadStatus)}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${statusBadge(l.status)}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
              {expanded === l.id && (
                <tr className="bg-gray-50/60">
                  <td colSpan={6} className="px-4 py-4">
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {l.rental_type && <DetailItem label="Rents" value={l.rental_type} />}
                      {l.current_software && <DetailItem label="Current software" value={l.current_software} />}
                      {l.message && (
                        <div className="sm:col-span-2">
                          <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Message</dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{l.message}</dd>
                        </div>
                      )}
                    </dl>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-700">{value}</dd>
    </div>
  );
}
