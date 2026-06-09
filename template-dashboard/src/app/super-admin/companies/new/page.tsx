import NewCompanyForm from "@/components/super-admin/new-company-form";

export const dynamic = "force-dynamic";

export default function NewCompanyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New company</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a company and invite its first owner. They&apos;ll get a Supabase
          magic-link email to set their password.
        </p>
      </div>
      <NewCompanyForm />
    </div>
  );
}
