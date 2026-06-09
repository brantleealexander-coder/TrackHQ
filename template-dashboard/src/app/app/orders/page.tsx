import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { listOrders, countOrdersByStatus, type OrderStatus } from "@/lib/order-queries";
import { requireMembership } from "@/lib/auth";
import OrderList from "@/components/orders/order-list";

export const dynamic = "force-dynamic";

const TABS: { key: OrderStatus; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  noStore();
  const { company_id } = await requireMembership();
  const activeTab: OrderStatus =
    (TABS.find((t) => t.key === searchParams.tab)?.key as OrderStatus) ?? "active";

  const [orders, counts] = await Promise.all([
    listOrders(company_id, { status: activeTab }),
    countOrdersByStatus(company_id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            All rental orders. Customers, dates, line items, and status.
          </p>
        </div>
        <Link
          href="/app/orders/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New order
        </Link>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={`/app/orders?tab=${tab.key}`}
              className={
                "relative -mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors " +
                (active
                  ? "border-brand-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700")
              }
            >
              {tab.label}
              <span
                className={
                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
                  (active ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-500")
                }
              >
                {counts[tab.key] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      <OrderList orders={orders} />
    </div>
  );
}
