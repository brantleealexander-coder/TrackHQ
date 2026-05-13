// QuickBooks Online API types

export interface QBTokens {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

// --- Report types ---

export interface ReportLineItem {
  name: string;
  amount: number;
  children?: ReportLineItem[];
}

export interface ProfitAndLossData {
  period: string;
  income: ReportLineItem[];
  costOfGoodsSold: ReportLineItem[];
  expenses: ReportLineItem[];
  otherExpenses: ReportLineItem[];
  totalIncome: number;
  totalCOGS: number;
  totalExpenses: number;
  netIncome: number;
}

export interface BalanceSheetData {
  asOf: string;
  assets: ReportLineItem[];
  liabilities: ReportLineItem[];
  equity: ReportLineItem[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface AgingRow {
  name: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91plus: number;
  total: number;
}

// --- Entity types ---

export interface QBInvoice {
  id: string;
  docNumber: string;
  customerName: string;
  txnDate: string;
  dueDate: string;
  totalAmt: number;
  balance: number;
  status: "paid" | "open" | "overdue";
}

export interface QBBill {
  id: string;
  vendorName: string;
  txnDate: string;
  dueDate: string;
  totalAmt: number;
  balance: number;
}

export interface QBCustomer {
  id: string;
  displayName: string;
  balance: number;
  email?: string;
  phone?: string;
}

export interface QBVendor {
  id: string;
  displayName: string;
  balance: number;
}

export interface QBConnectionStatus {
  connected: boolean;
  companyName?: string;
  lastSync?: string;
}
