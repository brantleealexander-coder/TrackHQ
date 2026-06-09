import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { getCustomer, createCustomerClient } from "@/lib/registry";
import { getAvailableCatalog } from "@/lib/booking-queries";
import BookingHeader from "@/components/booking/booking-header";
import AssetCatalog from "@/components/booking/asset-catalog";

export const dynamic = "force-dynamic";

export default async function BookCatalogPage({
  params,
}: {
  params: { slug: string };
}) {
  noStore();
  const customer = await getCustomer(params.slug);
  if (!customer) notFound();

  const client = createCustomerClient(customer);
  const units = await getAvailableCatalog(client, customer.company_id);

  return (
    <>
      <BookingHeader customer={customer} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-600">
            Online booking
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Reserve from{" "}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              {customer.business_name}
            </span>
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Browse available {customer.terminology_asset_plural.toLowerCase()} and submit a booking request. {customer.business_name} will confirm by email within one business day.
          </p>
        </div>

        <AssetCatalog slug={customer.slug} units={units} />
      </main>
      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {customer.business_name}. Booking powered by TrackHQ.
      </footer>
    </>
  );
}
