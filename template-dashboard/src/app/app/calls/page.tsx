import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { listCalls } from "@/lib/call-queries";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDuration(secs: number | null): string {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function outcomeBadge(outcome: string): string {
  if (outcome === "booking") return "bg-emerald-50 text-emerald-700";
  if (outcome === "quote") return "bg-brand-50 text-brand-700";
  if (outcome === "message") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

export default async function CallsPage() {
  noStore();
  const { company_id } = await requireMembership();
  const calls = await listCalls(company_id, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every call answered by your AI receptionist — with transcript and recording for review.
        </p>
      </div>

      {calls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-700">No calls yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Calls answered by your AI receptionist will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50/80">
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Caller</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Outcome</th>
                <th className="px-4 py-2.5">Summary</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calls.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtTime(c.started_at ?? c.created_at)}</td>
                  <td className="px-4 py-2.5 text-gray-900">{c.caller_name ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{c.caller_phone ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtDuration(c.duration_seconds)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${outcomeBadge(c.outcome)}`}>
                      {c.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <span className="line-clamp-1 max-w-md">{c.summary ?? "—"}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/app/calls/${c.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
