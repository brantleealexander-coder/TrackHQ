import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerProfile } from "@/lib/customer-detail-queries";
import { requireMembership } from "@/lib/auth";
import CustomerContactForm from "@/components/customers/customer-contact-form";

export const dynamic = "force-dynamic";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtCurrency(n: number | null): string {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "upcoming") return "bg-brand-50 text-brand-700";
  if (status === "completed") return "bg-gray-100 text-gray-700";
  if (status === "cancelled") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-700";
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  noStore();
  const membership = await requireMembership();
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) notFound();

  const customer = await getCustomerProfile(membership.company_id, id);
  if (!customer) notFound();

  const canEdit = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="space-y-8">
      <Link
        href="/app/customers"
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
      >
        ← Back to customers
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
        {customer.company && (
          <p className="mt-1 text-sm text-gray-500">{customer.company}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Lifetime revenue" value={fmtCurrency(customer.lifetime_revenue)} />
        <Stat label="Total orders" value={String(customer.orders.length)} />
        <Stat
          label="Active orders"
          value={String(customer.orders.filter((o) => o.status === "active").length)}
        />
        <Stat
          label="Customer since"
          value={new Date(customer.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        />
      </div>

      {/* Contact + Notes */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Contact info & notes
        </h2>
        <CustomerContactForm customer={customer} canEdit={canEdit} />
      </section>

      {/* Order history */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Order history</h2>
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600">
            {customer.orders.length}
          </span>
        </div>
        {customer.orders.length === 0 ? (
          <div className="px-6 pb-6 text-center">
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-6 text-sm text-gray-500">
              No orders yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-6 py-2.5">#</th>
                <th className="px-6 py-2.5">Status</th>
                <th className="px-6 py-2.5">Start</th>
                <th className="px-6 py-2.5">End</th>
                <th className="px-6 py-2.5">Assets</th>
                <th className="px-6 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customer.orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-6 py-2.5 font-mono text-xs">
                    <Link href={`/app/orders/${o.id}`} className="text-brand-600 hover:text-brand-700">
                      #{String(o.id).padStart(5, "0")}
                    </Link>
                  </td>
                  <td className="px-6 py-2.5">
                    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-2.5 tabular-nums text-gray-500">{fmtDate(o.rental_start)}</td>
                  <td className="px-6 py-2.5 tabular-nums text-gray-500">{fmtDate(o.rental_end)}</td>
                  <td className="px-6 py-2.5 tabular-nums text-gray-500">{o.asset_count}</td>
                  <td className="px-6 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                    {fmtCurrency(o.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}
