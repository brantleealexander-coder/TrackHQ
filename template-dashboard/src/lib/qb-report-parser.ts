// Parse Intuit's nested report JSON into flat structures
import type {
  ProfitAndLossData,
  BalanceSheetData,
  ReportLineItem,
  AgingRow,
} from "./qb-types";

// Intuit report row types (recursive)
interface IntuitColData {
  value: string;
  id?: string;
}

interface IntuitRow {
  type: "Section" | "Data" | "SectionRow";
  ColData?: IntuitColData[];
  Header?: { ColData: IntuitColData[] };
  Rows?: { Row: IntuitRow[] };
  Summary?: { ColData: IntuitColData[] };
  group?: string;
}

function parseAmount(val: string | undefined): number {
  if (!val || val === "") return 0;
  return parseFloat(val) || 0;
}

function extractLineItems(rows: IntuitRow[] | undefined): ReportLineItem[] {
  if (!rows) return [];

  return rows
    .map((row) => {
      if (row.type === "Data" && row.ColData) {
        return {
          name: row.ColData[0]?.value ?? "Unknown",
          amount: parseAmount(row.ColData[1]?.value),
        };
      }
      if (row.type === "Section") {
        const name = row.Header?.ColData?.[0]?.value ?? "Unknown";
        const children = extractLineItems(row.Rows?.Row);
        const summaryAmount = row.Summary?.ColData?.[1]?.value;
        return {
          name,
          amount: parseAmount(summaryAmount),
          children: children.length > 0 ? children : undefined,
        };
      }
      return null;
    })
    .filter((item): item is ReportLineItem => item !== null);
}

function findSectionByGroup(
  rows: IntuitRow[],
  group: string
): ReportLineItem[] {
  const section = rows.find((r) => r.group === group);
  if (!section) return [];
  return extractLineItems(section.Rows?.Row);
}

function findSectionTotal(rows: IntuitRow[], group: string): number {
  const section = rows.find((r) => r.group === group);
  if (!section?.Summary?.ColData?.[1]) return 0;
  return parseAmount(section.Summary.ColData[1].value);
}

export function parseProfitAndLoss(raw: any): ProfitAndLossData {
  const rows: IntuitRow[] = raw?.Rows?.Row ?? [];
  const header = raw?.Header;
  const startDate = header?.StartPeriod ?? "";
  const endDate = header?.EndPeriod ?? "";

  return {
    period: `${startDate} to ${endDate}`,
    income: findSectionByGroup(rows, "Income"),
    costOfGoodsSold: findSectionByGroup(rows, "COGS"),
    expenses: findSectionByGroup(rows, "Expenses"),
    otherExpenses: findSectionByGroup(rows, "OtherExpenses"),
    totalIncome: findSectionTotal(rows, "Income"),
    totalCOGS: findSectionTotal(rows, "COGS"),
    totalExpenses: findSectionTotal(rows, "Expenses"),
    netIncome: findSectionTotal(rows, "NetIncome"),
  };
}

export function parseBalanceSheet(raw: any): BalanceSheetData {
  const rows: IntuitRow[] = raw?.Rows?.Row ?? [];
  const header = raw?.Header;

  return {
    asOf: header?.StartPeriod ?? header?.EndPeriod ?? "",
    assets: findSectionByGroup(rows, "Assets") ?? findSectionByGroup(rows, "TotalAssets"),
    liabilities: findSectionByGroup(rows, "Liabilities") ?? findSectionByGroup(rows, "TotalLiabilities"),
    equity: findSectionByGroup(rows, "Equity") ?? findSectionByGroup(rows, "TotalEquity"),
    totalAssets: findSectionTotal(rows, "Assets") || findSectionTotal(rows, "TotalAssets"),
    totalLiabilities: findSectionTotal(rows, "Liabilities") || findSectionTotal(rows, "TotalLiabilities"),
    totalEquity: findSectionTotal(rows, "Equity") || findSectionTotal(rows, "TotalEquity"),
  };
}

export function parseAgingReport(raw: any): AgingRow[] {
  const rows: IntuitRow[] = raw?.Rows?.Row ?? [];
  const results: AgingRow[] = [];

  for (const row of rows) {
    if (row.type === "Section" && row.Header?.ColData) {
      const name = row.Header.ColData[0]?.value ?? "Unknown";
      const summary = row.Summary?.ColData;
      if (summary && summary.length >= 6) {
        results.push({
          name,
          current: parseAmount(summary[1]?.value),
          days1to30: parseAmount(summary[2]?.value),
          days31to60: parseAmount(summary[3]?.value),
          days61to90: parseAmount(summary[4]?.value),
          days91plus: parseAmount(summary[5]?.value),
          total: parseAmount(summary[6]?.value),
        });
      }
    } else if (row.type === "Data" && row.ColData && row.ColData.length >= 7) {
      results.push({
        name: row.ColData[0]?.value ?? "Unknown",
        current: parseAmount(row.ColData[1]?.value),
        days1to30: parseAmount(row.ColData[2]?.value),
        days31to60: parseAmount(row.ColData[3]?.value),
        days61to90: parseAmount(row.ColData[4]?.value),
        days91plus: parseAmount(row.ColData[5]?.value),
        total: parseAmount(row.ColData[6]?.value),
      });
    }
  }

  return results;
}
