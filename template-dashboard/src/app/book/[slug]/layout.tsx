import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/registry";
import { brandColorToRgbTriple } from "@/lib/tenant-config";

// Wraps every /book/<slug>/* page with the customer's brand color
// pushed into --brand-rgb so brand-{500,600,...} utilities resolve to
// the customer's palette (not TrackHQ navy).
export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const customer = await getCustomer(params.slug);
  if (!customer) notFound();

  const brandRgb = brandColorToRgbTriple(customer.brand_color);

  return (
    <div style={{ ["--brand-rgb" as string]: brandRgb }} className="min-h-screen bg-white">
      {children}
    </div>
  );
}
