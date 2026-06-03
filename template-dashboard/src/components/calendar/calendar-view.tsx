"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CalendarOrder } from "@/lib/calendar-queries";

interface CalendarViewProps {
  orders: CalendarOrder[];
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

  // Pad leading cells (Mon = 1 ... Sun = 0). Calendar starts on Sunday.
  const leading = first.getDay();
  for (let i = leading; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    cells.push({ date: d, inMonth: false });
  }
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }
  // Trailing — fill to a multiple of 7
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

export default function CalendarView({ orders, monthsToShow }: CalendarViewProps) {
  // Index orders by the dates they touch for O(1) day lookup.
  const ordersByDate = useMemo(() => {
    const map = new Map<string, CalendarOrder[]>();
    for (const o of orders) {
      const start = new Date(o.rental_start + "T00:00:00");
      const end = new Date(o.rental_end + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = ymd(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(o);
      }
    }
    return map;
  }, [orders]);

  // Start at the first month-of-current-month.
  const now = new Date();
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const todayKey = ymd(now);

  const [selected, setSelected] = useState<string | null>(todayKey);

  const months = Array.from({ length: monthsToShow }, (_, i) => ({
    year: baseYear + Math.floor((baseMonth + i) / 12),
    month: (baseMonth + i) % 12,
  }));

  const selectedOrders = selected ? ordersByDate.get(selected) ?? [] : [];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      {/* Months */}
      <div className="space-y-8 lg:col-span-3">
        {months.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            ordersByDate={ordersByDate}
            selected={selected}
            onSelect={setSelected}
            todayKey={todayKey}
          />
        ))}
      </div>

      {/* Side panel */}
      <aside className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            {selected ? formatDateLabel(selected) : "Select a day"}
          </h2>
          {selectedOrders.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-6 text-center">
              <p className="text-sm font-medium text-gray-700">No orders on this day.</p>
              <p className="mt-1 text-xs text-gray-500">Pick another day or start a new order.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {selectedOrders.map((o) => (
                <li key={o.id}>
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
        </div>
      </aside>
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
  ordersByDate,
  selected,
  onSelect,
  todayKey,
}: {
  year: number;
  month: number;
  ordersByDate: Map<string, CalendarOrder[]>;
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
          const count = ordersByDate.get(key)?.length ?? 0;
          const isToday = key === todayKey;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={
                "group relative aspect-square rounded-lg border text-xs transition-colors " +
                (isSelected
                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
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
              {count > 0 && (
                <span
                  className={
                    "absolute bottom-1.5 right-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums " +
                    (isSelected ? "bg-brand-600 text-white" : "bg-brand-500/15 text-brand-700")
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
