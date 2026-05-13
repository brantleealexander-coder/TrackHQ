"use client";

import { useState } from "react";
import PeriodSelector, { getPeriodDates } from "./period-selector";
import type { ProfitAndLossData, ReportLineItem } from "@/lib/qb-types";

interface PnlTabProps {
  initialData: ProfitAndLossData;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function LineItems({ items, depth = 0 }: { items: ReportLineItem[]; depth?: number }) {
  return (
    <>
      {items.map((item, i) => (
        <div key={`${item.name}-${i}`}>
          <div
            className="flex justify-between py-1.5 px-3 hover:bg-gray-50"
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            <span className={`text-sm ${depth === 0 && item.children ? "font-semibold text-gray-900" : "text-gray-600"}`}>
              {item.name}
            </span>
            <span className={`text-sm font-mono ${item.amount < 0 ? "text-red-600" : "text-gray-900"}`}>
              {fmt(item.amount)}
            </span>
          </div>
          {item.children && <LineItems items={item.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  );
}

export default function PnlTab({ initialData }: PnlTabProps) {
  const [period, setPeriod] = useState("ytd");
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  async function onPeriodChange(newPeriod: string) {
    setPeriod(newPeriod);
    setLoading(true);
    try {
      const { start, end } = getPeriodDates(newPeriod);
      const res = await fetch(`/api/quickbooks/reports/profit-and-loss?start_date=${start}&end_date=${end}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Profit & Loss</h3>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>

      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 ${loading ? "opacity-50" : ""}`}>
        {/* Income */}
        <div className="py-3">
          <div className="flex justify-between px-3 py-2 bg-green-50">
            <span className="text-sm font-bold text-green-800">Income</span>
            <span className="text-sm font-bold text-green-800 font-mono">{fmt(data.totalIncome)}</span>
          </div>
          <LineItems items={data.income} />
        </div>

        {/* COGS */}
        {data.costOfGoodsSold.length > 0 && (
          <div className="py-3">
            <div className="flex justify-between px-3 py-2 bg-amber-50">
              <span className="text-sm font-bold text-amber-800">Cost of Goods Sold</span>
              <span className="text-sm font-bold text-amber-800 font-mono">{fmt(data.totalCOGS)}</span>
            </div>
            <LineItems items={data.costOfGoodsSold} />
          </div>
        )}

        {/* Expenses */}
        <div className="py-3">
          <div className="flex justify-between px-3 py-2 bg-red-50">
            <span className="text-sm font-bold text-red-800">Expenses</span>
            <span className="text-sm font-bold text-red-800 font-mono">{fmt(data.totalExpenses)}</span>
          </div>
          <LineItems items={data.expenses} />
        </div>

        {/* Other Expenses */}
        {data.otherExpenses.length > 0 && (
          <div className="py-3">
            <div className="flex justify-between px-3 py-2 bg-gray-50">
              <span className="text-sm font-bold text-gray-700">Other Expenses</span>
            </div>
            <LineItems items={data.otherExpenses} />
          </div>
        )}

        {/* Net Income */}
        <div className={`flex justify-between px-3 py-4 ${data.netIncome >= 0 ? "bg-green-100" : "bg-red-100"}`}>
          <span className="text-base font-bold text-gray-900">Net Income</span>
          <span className={`text-base font-bold font-mono ${data.netIncome >= 0 ? "text-green-700" : "text-red-700"}`}>
            {fmt(data.netIncome)}
          </span>
        </div>
      </div>
    </div>
  );
}
