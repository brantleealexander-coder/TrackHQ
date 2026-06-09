import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { listCompanies } from "@/lib/super-admin-queries";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function SuperAdminCompaniesPage() {
  noStore();
  const companies = await listCompanies();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every company using TrackHQ. {companies.length} total.
          </p>
        </div>
        <Link
          href="/super-admin/companies/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md"
        >
          + New company
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50/80">
            <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Slug</th>
              <th className="px-4 py-2.5">Brand</th>
              <th className="px-4 py-2.5 text-right">Members</th>
              <th className="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{c.slug}</td>
                <td className="px-4 py-2.5">
                  <span
                    aria-hidden
                    className="inline-block h-4 w-4 rounded border border-gray-200 align-middle"
                    style={{ background: c.brand_color ?? "#9ca3af" }}
                  />
                  <span className="ml-2 align-middle font-mono text-xs text-gray-500">
                    {c.brand_color ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                  {c.member_count}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
