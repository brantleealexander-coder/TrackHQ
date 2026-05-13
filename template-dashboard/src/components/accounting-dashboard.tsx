"use client";

import { useState } from "react";
import QBStatusBadge from "./qb-status-badge";
import OverviewTab from "./accounting/overview-tab";
import PnlTab from "./accounting/pnl-tab";
import BalanceSheetTab from "./accounting/balance-sheet-tab";
import InvoicesTab from "./accounting/invoices-tab";
import ReceivablesTab from "./accounting/receivables-tab";
import PayablesTab from "./accounting/payables-tab";
import CustomersVendorsTab from "./accounting/customers-vendors-tab";
import type {
  ProfitAndLossData,
  BalanceSheetData,
  AgingRow,
  QBInvoice,
  QBBill,
  QBCustomer,
  QBVendor,
} from "@/lib/qb-types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "pnl", label: "Profit & Loss" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "invoices", label: "Invoices" },
  { id: "receivables", label: "Receivables" },
  { id: "payables", label: "Payables" },
  { id: "customers-vendors", label: "Customers & Vendors" },
];

interface AccountingDashboardProps {
  companyName: string;
  pnl: ProfitAndLossData;
  balanceSheet: BalanceSheetData;
  invoices: QBInvoice[];
  bills: QBBill[];
  arAging: AgingRow[];
  apAging: AgingRow[];
  customers: QBCustomer[];
  vendors: QBVendor[];
}

export default function AccountingDashboard(props: AccountingDashboardProps) {
  const [tab, setTab] = useState("overview");

  return (
    <div>
      <QBStatusBadge companyName={props.companyName} />

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto bg-gray-100 rounded-lg p-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              tab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <OverviewTab
          pnl={props.pnl}
          balanceSheet={props.balanceSheet}
          arAging={props.arAging}
          apAging={props.apAging}
        />
      )}
      {tab === "pnl" && <PnlTab initialData={props.pnl} />}
      {tab === "balance-sheet" && <BalanceSheetTab data={props.balanceSheet} />}
      {tab === "invoices" && <InvoicesTab invoices={props.invoices} />}
      {tab === "receivables" && <ReceivablesTab aging={props.arAging} />}
      {tab === "payables" && <PayablesTab bills={props.bills} aging={props.apAging} />}
      {tab === "customers-vendors" && (
        <CustomersVendorsTab customers={props.customers} vendors={props.vendors} />
      )}
    </div>
  );
}
