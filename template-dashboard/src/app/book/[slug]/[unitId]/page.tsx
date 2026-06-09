import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, createCustomerClient } from "@/lib/registry";
import { getCatalogUnit } from "@/lib/booking-queries";
import BookingHeader from "@/components/booking/booking-header";
import BookingForm from "@/components/booking/booking-form";

export const dynamic = "force-dynamic";

function fmtRate(n: number | null): string | null {
  if (n == null) return null;
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function BookUnitPage({
  params,
}: {
  params: { slug: string; unitId: string };
}) {
  noStore();
  const customer = await getCustomer(params.slug);
  if (!customer) notFound();

  const id = parseInt(params.unitId, 10);
  if (Number.isNaN(id)) notFound();

  const client = createCustomerClient(customer);
  const unit = await getCatalogUnit(client, customer.company_id, id);
  if (!unit) notFound();

  return (
    <>
      <BookingHeader customer={customer} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href={`/book/${customer.slug}`}
          className="inline-flex items-center gap-1 text-sm text-brand-600 transition-colors hover:text-brand-700"
        >
          ← Back to catalog
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-5">
          {/* Unit summary */}
          <div className="lg:col-span-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              {unit.year ? `${unit.year} · ` : ""}{unit.category_name}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {unit.equipment_name}
            </h1>
            <p className="mt-2 font-mono text-xs text-gray-500">{unit.gl_code}</p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <RateBox label="Daily" value={fmtRate(unit.rate_daily)} />
              <RateBox label="Weekly" value={fmtRate(unit.rate_weekly)} />
              <RateBox label="Monthly" value={fmtRate(unit.rate_monthly)} />
            </div>

            <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50/60 p-5">
              <p className="text-sm text-gray-700">
                Questions about this {customer.terminology_asset_singular.toLowerCase()}? {customer.business_name} can confirm specs, delivery options, and exact pricing after you submit a request.
              </p>
            </div>
          </div>

          {/* Booking form */}
          <div className="lg:col-span-2">
            <BookingForm
              slug={customer.slug}
              unit={unit}
              customerName={customer.business_name}
            />
          </div>
        </div>
      </main>
    </>
  );
}

function RateBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
        {value ?? <span className="text-gray-400">—</span>}
      </p>
    </div>
  );
}
