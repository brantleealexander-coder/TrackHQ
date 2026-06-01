interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "blue" | "red" | "amber" | "gray" | "orange" | "brand";
  primary?: boolean;
}

const dotMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  gray: "bg-gray-400",
  orange: "bg-orange-500",
  brand: "bg-brand-500",
};

export default function StatCard({ label, value, sub, accent = "gray", primary = false }: StatCardProps) {
  if (primary) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-brand-50/40 p-6 shadow-sm">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dotMap[accent]}`} />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums text-gray-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dotMap[accent]}`} />
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      </div>
      <p className="mt-2.5 text-3xl font-semibold tracking-tight tabular-nums text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
