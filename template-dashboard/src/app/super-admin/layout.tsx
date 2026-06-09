import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/super-admin/companies" className="text-base font-semibold tracking-tight text-gray-900">
              TrackHQ · Super Admin
            </Link>
            <nav className="hidden gap-5 sm:flex">
              <Link href="/super-admin/companies" className="text-sm text-gray-600 hover:text-gray-900">
                Companies
              </Link>
              <Link href="/super-admin/leads" className="text-sm text-gray-600 hover:text-gray-900">
                Leads
              </Link>
            </nav>
          </div>
          <Link href="/app/dashboard" className="text-xs text-gray-500 hover:text-gray-700">
            ← Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
