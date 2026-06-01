import Link from "next/link";
import type { CatalogUnit } from "@/lib/booking-queries";

function fmtRate(n: number | null): string | null {
  if (n == null) return null;
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function PrimaryRate({ unit }: { unit: CatalogUnit }) {
  const daily = fmtRate(unit.rate_daily);
  const weekly = fmtRate(unit.rate_weekly);
  const monthly = fmtRate(unit.rate_monthly);
  // Prefer the smallest period that's set so it reads as a "starting at"
  // anchor — most renters compare daily rates first.
  if (daily) return <><span className="tabular-nums font-semibold text-gray-900">{daily}</span><span className="text-gray-500"> / day</span></>;
  if (weekly) return <><span className="tabular-nums font-semibold text-gray-900">{weekly}</span><span className="text-gray-500"> / wk</span></>;
  if (monthly) return <><span className="tabular-nums font-semibold text-gray-900">{monthly}</span><span className="text-gray-500"> / mo</span></>;
  return <span className="text-gray-400">Call for pricing</span>;
}

export default function AssetCatalog({
  slug,
  units,
}: {
  slug: string;
  units: CatalogUnit[];
}) {
  if (units.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-base font-medium text-gray-700">Nothing available right now.</p>
        <p className="mt-1 text-sm text-gray-500">
          Check back soon — or call us and we&apos;ll see what we can do.
        </p>
      </div>
    );
  }

  const byCategory = new Map<string, CatalogUnit[]>();
  for (const u of units) {
    if (!byCategory.has(u.category_name)) byCategory.set(u.category_name, []);
    byCategory.get(u.category_name)!.push(u);
  }

  return (
    <div className="mt-10 space-y-12">
      {[...byCategory.entries()].map(([category, items]) => (
        <section key={category}>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{category}</h2>
            <span className="h-px flex-1 bg-gray-200" aria-hidden />
            <span className="text-xs tabular-nums text-gray-400">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((unit) => (
              <Link
                key={unit.id}
                href={`/book/${slug}/${unit.id}`}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    {unit.year ? `${unit.year} · ` : ""}{unit.category_name}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-gray-900 group-hover:text-brand-700">
                    {unit.equipment_name}
                  </h3>
                </div>
                <div className="mt-5 flex items-baseline justify-between border-t border-gray-100 pt-4">
                  <p className="text-sm">
                    <PrimaryRate unit={unit} />
                  </p>
                  <span className="text-xs font-medium text-brand-600 group-hover:text-brand-700">
                    Reserve →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
