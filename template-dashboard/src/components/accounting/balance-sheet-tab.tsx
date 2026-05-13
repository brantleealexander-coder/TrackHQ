"use client";

import type { BalanceSheetData, ReportLineItem } from "@/lib/qb-types";

interface BalanceSheetTabProps {
  data: BalanceSheetData;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function Section({
  title,
  items,
  total,
  color,
}: {
  title: string;
  items: ReportLineItem[];
  total: number;
  color: string;
}) {
  return (
    <div className="py-3">
      <div className={`flex justify-between px-3 py-2 ${color}`}>
        <span className="text-sm font-bold">{title}</span>
        <span className="text-sm font-bold font-mono">{fmt(total)}</span>
      </div>
      {items.map((item, i) => (
        <div key={`${item.name}-${i}`}>
          <div className="flex justify-between py-1.5 px-3 hover:bg-gray-50">
            <span className={`text-sm ${item.children ? "font-semibold text-gray-900" : "text-gray-600"}`}>
              {item.name}
            </span>
            <span className="text-sm font-mono text-gray-900">{fmt(item.amount)}</span>
          </div>
          {item.children?.map((child, ci) => (
            <div key={`${child.name}-${ci}`} className="flex justify-between py-1 hover:bg-gray-50" style={{ paddingLeft: "32px", paddingRight: "12px" }}>
              <span className="text-sm text-gray-500">{child.name}</span>
              <span className="text-sm font-mono text-gray-700">{fmt(child.amount)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function BalanceSheetTab({ data }: BalanceSheetTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Balance Sheet</h3>
        <span className="text-sm text-gray-500">As of {data.asOf}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        <Section title="Assets" items={data.assets} total={data.totalAssets} color="bg-blue-50 text-blue-800" />
        <Section title="Liabilities" items={data.liabilities} total={data.totalLiabilities} color="bg-red-50 text-red-800" />
        <Section title="Equity" items={data.equity} total={data.totalEquity} color="bg-green-50 text-green-800" />
      </div>
    </div>
  );
}
