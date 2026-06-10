"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CalendarOrder, CalendarPending } from "@/lib/calendar-queries";

interface CalendarViewProps {
  orders: CalendarOrder[];
  pending: CalendarPending[];
  monthsToShow: number;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function buildMonthCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(year, month);
  const last = new Date(year, month + 1, 0);
  const cells: { date: Date; inMonth: boolean }[] = [];

  const leading = first.getDay();
  for (let i = leading; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    cells.push({ date: d, inMonth: false });
  }
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }
  return cells;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusColor(status: string): string {
  if (status === "active") return "bg-emerald-500";
  if (status === "upcoming") return "bg-brand-500";
  if (status === "completed") return "bg-gray-400";
  return "bg-gray-300";
}

interface DayBuckets {
  orders: CalendarOrder[];
  pending: CalendarPending[];
}

export default function CalendarView({ orders, pending, monthsToShow }: CalendarViewProps) {
  const byDate = useMemo(() => {
    const map = new Map<string, DayBuckets>();
    const bucket = (key: string) => {
      let b = map.get(key);
      if (!b) {
        b = { orders: [], pending: [] };
        map.set(key, b);
      }
      return b;
    };
    for (const o of orders) {
      const start = new Date(o.rental_start + "T00:00:00");
      const end = new Date(o.rental_end + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        bucket(ymd(d)).orders.push(o);
      }
    }
    for (const p of pending) {
      const start = new Date(p.rental_start + "T00:00:00");
      const end = new Date(p.rental_end + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        bucket(ymd(d)).pending.push(p);
      }
    }
    return map;
  }, [orders, pending]);

  const now = new Date();
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const todayKey = ymd(now);

  const [selected, setSelected] = useState<string | null>(todayKey);

  const months = Array.from({ length: monthsToShow }, (_, i) => ({
    year: baseYear + Math.floor((baseMonth + i) / 12),
    month: (baseMonth + i) % 12,
  }));

  const selectedBucket = selected ? byDate.get(selected) ?? { orders: [], pending: [] } : { orders: [], pending: [] };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      <div className="space-y-8 lg:col-span-3">
        {months.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            byDate={byDate}
            selected={selected}
            onSelect={setSelected}
            todayKey={todayKey}
          />
        ))}
        <Legend />
      </div>

      <aside className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            {selected ? formatDateLabel(selected) : "Select a day"}
          </h2>

          {selectedBucket.orders.length === 0 && selectedBucket.pending.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-6 text-center">
              <p className="text-sm font-medium text-gray-700">Nothing on this day.</p>
              <p className="mt-1 text-xs text-gray-500">Pick another day or start a new order.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {selectedBucket.orders.length > 0 && (
                <ul className="space-y-2">
                  {selectedBucket.orders.map((o) => (
                    <li key={`o-${o.id}`}>
                      <Link
                        href={`/app/orders/${o.id}`}
                        className="group block rounded-lg border border-gray-100 px-3 py-2.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900 group-hover:text-brand-700">
                              {o.customer_name}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {o.asset_count} asset{o.asset_count === 1 ? "" : "s"}
                              {o.total != null && ` · $${Math.round(o.total).toLocaleString()}`}
                            </p>
                          </div>
                          <span className={`flex-shrink-0 h-2 w-2 rounded-full ${statusColor(o.status)}`} aria-hidden />
                        </div>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {formatRange(o.rental_start, o.rental_end)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {selectedBucket.pending.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                    Pending — needs review
                  </p>
                  <ul className="space-y-2">
                    {selectedBucket.pending.map((p) => (
                      <PendingItem key={`p-${p.id}`} row={p} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function PendingItem({ row }: { row: CalendarPending }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function act(kind: "approve" | "reject") {
    if (kind === "reject" && !confirm(`Reject this booking from ${row.customer_name}?`)) return;
    setBusy(kind);
    try {
      await fetch(`/api/booking-requests/${row.id}/${kind}`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {row.customer_name}
          </p>
          <p className="mt-0.5 text-xs text-gray-600">{row.equipment_name}</p>
          <p className="mt-1 text-[11px] text-gray-500">
            {formatRange(row.rental_start, row.rental_end)}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => act("reject")}
          disabled={busy !== null}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
        <button
          onClick={() => act("approve")}
          disabled={busy !== null}
          className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "approve" ? "…" : "Approve"}
        </button>
      </div>
    </li>
  );
}

function Legend() {
  const dot = "inline-block h-2 w-2 rounded-full align-middle";
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 px-1 text-[11px] text-gray-500">
      <span><span className={`${dot} bg-emerald-500`} /> Active</span>
      <span><span className={`${dot} bg-brand-500`} /> Upcoming</span>
      <span><span className="inline-block h-2 w-2 rounded-full border border-amber-500 align-middle" /> Pending</span>
      <span><span className={`${dot} bg-gray-400`} /> Completed</span>
    </div>
  );
}

function formatDateLabel(key: string): string {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sameYear = s.getFullYear() === e.getFullYear();
  const sStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  const eStr = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${sStr} → ${eStr}`;
}

function MonthGrid({
  year,
  month,
  byDate,
  selected,
  onSelect,
  todayKey,
}: {
  year: number;
  month: number;
  byDate: Map<string, DayBuckets>;
  selected: string | null;
  onSelect: (key: string) => void;
  todayKey: string;
}) {
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          {MONTHS[month]} <span className="text-gray-400">{year}</span>
        </h2>
      </header>
      <div className="grid grid-cols-7 gap-px text-center">
        {WEEKDAYS.map((w) => (
          <p key={w} className="pb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
            {w}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map(({ date, inMonth }) => {
          const key = ymd(date);
          const bucket = byDate.get(key);
          const orderCount = bucket?.orders.length ?? 0;
          const pendingCount = bucket?.pending.length ?? 0;
          const isToday = key === todayKey;
          const isSelected = key === selected;
          const hasPending = pendingCount > 0;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={
                "group relative aspect-square rounded-lg border text-xs transition-colors " +
                (isSelected
                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
                  : hasPending
                  ? "border-amber-300 bg-amber-50/40 text-gray-900 hover:border-amber-400"
                  : isToday
                  ? "border-brand-200 bg-white text-gray-900"
                  : inMonth
                  ? "border-gray-100 bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50"
                  : "border-transparent text-gray-300 hover:bg-gray-50")
              }
            >
              <span className={"absolute left-1.5 top-1 tabular-nums " + (isToday ? "font-semibold" : "")}>
                {date.getDate()}
              </span>
              {(orderCount > 0 || pendingCount > 0) && (
                <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                  {pendingCount > 0 && (
                    <span
                      className={
                        "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full border px-1 text-[10px] font-semibold tabular-nums " +
                        (isSelected
                          ? "border-amber-600 bg-amber-100 text-amber-800"
                          : "border-amber-500 bg-amber-50 text-amber-700")
                      }
                    >
                      {pendingCount}
                    </span>
                  )}
                  {orderCount > 0 && (
                    <span
                      className={
                        "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums " +
                        (isSelected ? "bg-brand-600 text-white" : "bg-brand-500/15 text-brand-700")
                      }
                    >
                      {orderCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
