import { unstable_noStore as noStore } from "next/cache";
import { listLeads } from "@/lib/super-admin-queries";
import LeadsTable from "@/components/super-admin/leads-table";

export const dynamic = "force-dynamic";

export default async function SuperAdminLeadsPage() {
  noStore();
  const leads = await listLeads();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Submissions from /demo and /contact. {leads.length} total.
        </p>
      </div>
      <LeadsTable leads={leads} />
    </div>
  );
}
