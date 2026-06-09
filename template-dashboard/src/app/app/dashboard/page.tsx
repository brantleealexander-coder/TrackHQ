import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { getStatuses } from "@/lib/queries";
import {
  getDashboardKpis,
  getDashboardAlerts,
  getRecentActivity,
  type DashboardAlert,
  type ActivityEvent,
} from "@/lib/dashboard-queries";
import { formatCurrency } from "@/lib/financials";
import { getTenantConfig } from "@/lib/tenant-config";
import { requireMembership } from "@/lib/auth";
import StatCard from "@/components/stat-card";

export const dynamic = "force-dynamic";

function fmtMoMSub(pct: number | null): string | undefined {
  if (pct == null) return "No prior-month revenue";
  if (pct === 0) return "Flat vs last month";
  const arrow = pct > 0 ? "↑" : "↓";
  return `${arrow}${Math.abs(pct)}% vs last month`;
}

function fmtRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export default async function DashboardPage() {
  noStore();
  const membership = await requireMembership();
  const { terminology } = getTenantConfig();
  const statuses = await getStatuses();

  const [kpis, alerts, activity] = await Promise.all([
    getDashboardKpis(membership.company_id, statuses),
    getDashboardAlerts(membership.company_id, statuses),
    getRecentActivity(membership.company_id, 15),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          {membership.company.name} · today at a glance
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active rentals"
          value={kpis.activeRentalsCount}
          accent="green"
          primary
        />
        <StatCard
          label="This month revenue"
          value={formatCurrency(kpis.monthRevenue)}
          sub={fmtMoMSub(kpis.momChangePct)}
          accent="brand"
        />
        <StatCard
          label="Pending requests"
          value={kpis.pendingRequestsCount}
          accent={kpis.pendingRequestsCount > 0 ? "amber" : "gray"}
          sub={kpis.pendingRequestsCount > 0 ? "Awaiting confirmation" : undefined}
        />
        <StatCard
          label="Last month revenue"
          value={formatCurrency(kpis.prevMonthRevenue)}
          accent="gray"
        />
      </div>

      {/* Two-column: alerts + activity */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <AlertsCard alerts={alerts} terminologySingular={terminology.asset_singular} />
        <ActivityCard activity={activity} />
      </div>
    </div>
  );
}

function AlertsCard({
  alerts,
  terminologySingular,
}: {
  alerts: DashboardAlert[];
  terminologySingular: string;
}) {
  return (
    <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Needs attention</h2>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600">
          {alerts.length}
        </span>
      </div>
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-6 text-center">
          <p className="text-sm font-medium text-gray-700">All clear</p>
          <p className="mt-1 text-xs text-gray-500">
            No overdue returns, pending requests, or down {terminologySingular.toLowerCase()}s.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i}>
              <Link
                href={a.href}
                className="group flex items-start gap-3 rounded-lg border border-gray-100 px-3 py-2.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
              >
                <AlertDot kind={a.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-brand-700">{a.title}</p>
                  {a.detail && <p className="mt-0.5 text-xs text-gray-500">{a.detail}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertDot({ kind }: { kind: DashboardAlert["kind"] }) {
  const color =
    kind === "overdue" ? "bg-red-500" : kind === "request" ? "bg-amber-500" : "bg-gray-400";
  return <span aria-hidden className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${color}`} />;
}

function ActivityCard({ activity }: { activity: ActivityEvent[] }) {
  return (
    <section className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Recent activity</h2>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600">
          {activity.length}
        </span>
      </div>
      {activity.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-6 text-center">
          <p className="text-sm font-medium text-gray-700">No recent activity</p>
          <p className="mt-1 text-xs text-gray-500">
            New orders, booking requests, and closed rentals will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {activity.map((e, i) => {
            const inner = (
              <div className="flex items-start gap-3 py-2.5">
                <ActivityIcon kind={e.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{e.title}</p>
                  {e.detail && <p className="truncate text-xs text-gray-500">{e.detail}</p>}
                </div>
                <span className="flex-shrink-0 text-xs tabular-nums text-gray-400">{fmtRelativeTime(e.at)}</span>
              </div>
            );
            return (
              <li key={i}>
                {e.href ? (
                  <Link href={e.href} className="block rounded-md px-1 transition-colors hover:bg-gray-50">
                    {inner}
                  </Link>
                ) : (
                  <div className="px-1">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ActivityIcon({ kind }: { kind: ActivityEvent["kind"] }) {
  const colors: Record<ActivityEvent["kind"], string> = {
    order_created: "bg-brand-500/15 text-brand-700",
    request_received: "bg-amber-500/15 text-amber-700",
    rental_closed: "bg-emerald-500/15 text-emerald-700",
  };
  const labels: Record<ActivityEvent["kind"], string> = {
    order_created: "O",
    request_received: "R",
    rental_closed: "✓",
  };
  return (
    <span
      aria-hidden
      className={`mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${colors[kind]}`}
    >
      {labels[kind]}
    </span>
  );
}
