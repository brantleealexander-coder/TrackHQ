"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerWithStats } from "@/lib/customer-queries";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CustomerSearch({ customers }: { customers: CustomerWithStats[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => {
      return (
        c.name.toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term) ||
        (c.company ?? "").toLowerCase().includes(term)
      );
    });
  }, [customers, q]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, email, phone, or company…"
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-700">
            {q ? "No customers match." : "No customers yet."}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Customers are added automatically when you create an order or accept a booking.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5 text-right">Active</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Last rental</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-gray-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/app/customers/${c.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                      {c.name}
                    </Link>
                    {c.company && <p className="text-[11px] text-gray-500">{c.company}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{c.email || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700">{c.phone || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{c.active_orders}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{c.total_orders}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(c.last_rental_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
