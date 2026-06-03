import { unstable_noStore as noStore } from "next/cache";
import { listCustomersWithStats } from "@/lib/customer-queries";
import CustomerSearch from "@/components/customers/customer-search";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  noStore();
  const customers = await listCustomersWithStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everyone who has rented from you, with their order history.
        </p>
      </div>
      <CustomerSearch customers={customers} />
    </div>
  );
}
