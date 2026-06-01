import { unstable_noStore as noStore } from "next/cache";
import { isQBConnected, fetchProfitAndLoss, fetchBalanceSheet, fetchInvoices, fetchBills, fetchAgedReceivables, fetchAgedPayables, fetchCustomers, fetchVendors, fetchCompanyInfo } from "@/lib/quickbooks";
import QBConnectPrompt from "@/components/qb-connect-prompt";
import AccountingDashboard from "@/components/accounting-dashboard";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  noStore();

  const connected = await isQBConnected();

  if (!connected) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Accounting</h1>
        <QBConnectPrompt />
      </div>
    );
  }

  try {
    const [companyName, pnl, balanceSheet, invoices, bills, arAging, apAging, customers, vendors] =
      await Promise.all([
        fetchCompanyInfo(),
        fetchProfitAndLoss(),
        fetchBalanceSheet(),
        fetchInvoices(),
        fetchBills(),
        fetchAgedReceivables(),
        fetchAgedPayables(),
        fetchCustomers(),
        fetchVendors(),
      ]);

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Accounting</h1>
        <AccountingDashboard
          companyName={companyName}
          pnl={pnl}
          balanceSheet={balanceSheet}
          invoices={invoices}
          bills={bills}
          arAging={arAging}
          apAging={apAging}
          customers={customers}
          vendors={vendors}
        />
      </div>
    );
  } catch (error: any) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Accounting</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 font-medium mb-2">Failed to load QuickBooks data</p>
          <p className="text-red-600 text-sm">{error.message}</p>
          <p className="text-gray-500 text-sm mt-4">
            This may mean the QuickBooks connection has expired.
          </p>
          <QBConnectPrompt />
        </div>
      </div>
    );
  }
}
