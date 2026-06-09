import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { getAvailableAssets } from "@/lib/available-assets";
import { requireMembership } from "@/lib/auth";
import NewOrderForm from "@/components/orders/new-order-form";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  noStore();
  const membership = await requireMembership();
  const assets = await getAvailableAssets(membership.company_id);
  const canAddCustomer = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="space-y-6">
      <Link
        href="/app/orders"
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
      >
        ← Back to orders
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New order</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pick a customer, dates, and one or more assets. The order goes
          straight into your queue.
        </p>
      </div>

      <NewOrderForm assets={assets} canAddCustomer={canAddCustomer} />
    </div>
  );
}
