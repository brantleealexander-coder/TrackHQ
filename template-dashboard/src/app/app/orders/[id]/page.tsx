import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/order-queries";
import OrderActions from "@/components/orders/order-actions";

export const dynamic = "force-dynamic";

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
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
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "upcoming") return "bg-brand-50 text-brand-700 ring-brand-200";
  if (status === "completed") return "bg-gray-100 text-gray-700 ring-gray-200";
  if (status === "cancelled") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  noStore();
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) notFound();

  const order = await getOrderDetail(id);
  if (!order) notFound();

  return (
    <div className="space-y-8">
      <Link
        href="/app/orders"
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
      >
        ← Back to orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-gray-500">
            Order #{String(order.id).padStart(5, "0")}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {order.customer.name}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {fmtDate(order.rental_start)} → {fmtDate(order.rental_end)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span
            className={
              "inline-flex rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset " +
              statusBadgeClass(order.status)
            }
          >
            {order.status}
          </span>
          <OrderActions orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      {/* Customer card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Customer
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="Name" value={order.customer.name} />
          <Field label="Email" value={order.customer.email} />
          <Field label="Phone" value={order.customer.phone} />
          <Field label="Company" value={order.customer.company} />
        </dl>
        <div className="mt-5">
          <Link
            href={`/app/customers/${order.customer.id}`}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            View customer profile →
          </Link>
        </div>
      </section>

      {/* Line items */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center justify-between px-6 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Line items</h2>
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600">
            {order.lines.length}
          </span>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-2.5">GL Code</th>
              <th className="px-6 py-2.5">Asset</th>
              <th className="px-6 py-2.5">Rate</th>
              <th className="px-6 py-2.5 text-right">Rate amount</th>
              <th className="px-6 py-2.5 text-right">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-6 py-2.5 font-mono text-xs text-gray-700">
                  <Link
                    href={`/app/fleet/${line.equipment_id}`}
                    className="hover:text-brand-700"
                  >
                    {line.gl_code}
                  </Link>
                </td>
                <td className="px-6 py-2.5 text-gray-900">{line.equipment_name}</td>
                <td className="px-6 py-2.5 text-gray-700">{line.rate_type}</td>
                <td className="px-6 py-2.5 text-right tabular-nums text-gray-700">
                  {fmtCurrency(line.rate_amount)}
                </td>
                <td className="px-6 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                  {fmtCurrency(line.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50/50">
              <td colSpan={4} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Order total
              </td>
              <td className="px-6 py-3 text-right text-base font-bold tabular-nums text-gray-900">
                {fmtCurrency(order.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Notes */}
      {order.notes && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{order.notes}</p>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}
