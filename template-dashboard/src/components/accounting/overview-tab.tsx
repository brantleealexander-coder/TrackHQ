"use client";

import StatCard from "@/components/stat-card";
import type { ProfitAndLossData, BalanceSheetData, AgingRow } from "@/lib/qb-types";

interface OverviewTabProps {
  pnl: ProfitAndLossData;
  balanceSheet: BalanceSheetData;
  arAging: AgingRow[];
  apAging: AgingRow[];
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function OverviewTab({ pnl, balanceSheet, arAging, apAging }: OverviewTabProps) {
  const totalAR = arAging.reduce((s, r) => s + r.total, 0);
  const totalAP = apAging.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-8">
      {/* P&L Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Profit & Loss ({pnl.period})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Revenue" value={fmt(pnl.totalIncome)} accent="green" />
          <StatCard label="Total Expenses" value={fmt(pnl.totalExpenses + pnl.totalCOGS)} accent="red" />
          <StatCard
            label="Net Income"
            value={fmt(pnl.netIncome)}
            accent={pnl.netIncome >= 0 ? "green" : "orange"}
          />
        </div>
      </div>

      {/* Balance Sheet Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Balance Sheet (as of {balanceSheet.asOf})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Assets" value={fmt(balanceSheet.totalAssets)} accent="blue" />
          <StatCard label="Total Liabilities" value={fmt(balanceSheet.totalLiabilities)} accent="red" />
          <StatCard label="Total Equity" value={fmt(balanceSheet.totalEquity)} accent="green" />
        </div>
      </div>

      {/* AR / AP */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Receivables & Payables
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Accounts Receivable" value={fmt(totalAR)} accent="amber" sub="Total outstanding" />
          <StatCard label="Accounts Payable" value={fmt(totalAP)} accent="red" sub="Total owed" />
        </div>
      </div>
    </div>
  );
}
