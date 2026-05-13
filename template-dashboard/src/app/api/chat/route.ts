import { streamText, tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isQBConnected, fetchProfitAndLoss, fetchBalanceSheet, fetchInvoices, fetchAgedReceivables, fetchAgedPayables } from "@/lib/quickbooks";
import { isVisionLinkConfigured, fetchFleetTelematics } from "@/lib/visionlink";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function getSupabase() {
  const key =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: `You are the CrossMar Equipment Rental fleet assistant. You have live access to the company's equipment database.

You can answer questions about:
- Current fleet status (who has what equipment, what's available or down)
- Rental history (past customers, rental periods, revenue per unit)
- Financial performance (monthly/YTD revenue, utilization %, overdue rentals)
- Maintenance records (costs, repairs, vendors)
- QuickBooks accounting data (profit & loss, balance sheet, invoices, accounts receivable/payable)
- Equipment telematics (engine hours, fault codes, GPS location, fuel level, idle time) via Cat VisionLink

If asked about QuickBooks data but QuickBooks is not connected, tell the user to connect QuickBooks on the Accounting page first.
If asked about telematics but VisionLink is not configured, tell the user VisionLink credentials need to be added.
Always use your tools to fetch live data before answering. Be concise and professional.
Format currency as USD (e.g. $1,200). Format dates as "Jan 5, 2025".
When listing equipment, include the GL code and name.
For any status count question (how many units are on rent, available, down, etc.), always call getFinancialSummary and read the count from the utilization object — never tally items yourself from getFleetStatus.`,
    messages,
    tools: {
      getFleetStatus: tool({
        description:
          "Get the current status of all equipment in the fleet — who has what, what's available, on rent, down, or reserved.",
        parameters: z.object({}),
        execute: async () => {
          const supabase = getSupabase();
          const { data, error } = await supabase
            .from("equipment")
            .select(
              `gl_code, equipment_name, division_id,
               divisions ( name ),
               equipment_status ( status, customer_name, job_po_notes, rental_start, rental_end )`
            )
            .order("gl_code", { ascending: true });
          if (error) return { error: error.message };
          return data ?? [];
        },
      }),

      getFinancialSummary: tool({
        description:
          "Get financial summary: rental revenue totals (monthly, YTD, all-time), fleet utilization percentage, and any overdue rentals.",
        parameters: z.object({}),
        execute: async () => {
          const supabase = getSupabase();
          const [histRes, statusRes, maintRes] = await Promise.all([
            supabase
              .from("rental_history")
              .select("revenue_amount, rental_start, status_after")
              .not("revenue_amount", "is", null),
            supabase.from("equipment_status").select("status"),
            supabase.from("maintenance_logs").select("cost, date"),
          ]);

          const history = histRes.data ?? [];
          const statuses = statusRes.data ?? [];
          const maintenance = maintRes.data ?? [];

          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const yearStart = new Date(now.getFullYear(), 0, 1);

          let monthRevenue = 0, ytdRevenue = 0, allTimeRevenue = 0;
          for (const r of history) {
            const amt = r.revenue_amount ?? 0;
            allTimeRevenue += amt;
            if (r.rental_start) {
              const d = new Date(r.rental_start);
              if (d >= yearStart) ytdRevenue += amt;
              if (d >= monthStart) monthRevenue += amt;
            }
          }

          let monthMaint = 0, ytdMaint = 0, allTimeMaint = 0;
          for (const m of maintenance) {
            const c = m.cost ?? 0;
            allTimeMaint += c;
            if (m.date) {
              const d = new Date(m.date + "T00:00:00");
              if (d >= yearStart) ytdMaint += c;
              if (d >= monthStart) monthMaint += c;
            }
          }

          const counts: Record<string, number> = {};
          for (const s of statuses) {
            counts[s.status] = (counts[s.status] ?? 0) + 1;
          }
          const total = statuses.length;
          const onRent = counts["ON RENT"] ?? 0;
          const down = counts["DOWN"] ?? 0;
          const rentable = total - down;
          const utilization = rentable > 0 ? Math.round((onRent / rentable) * 100) : 0;

          return {
            revenue: {
              thisMonth: monthRevenue,
              ytd: ytdRevenue,
              allTime: allTimeRevenue,
              netProfitAllTime: allTimeRevenue - allTimeMaint,
            },
            maintenance: {
              thisMonth: monthMaint,
              ytd: ytdMaint,
              allTime: allTimeMaint,
            },
            utilization: {
              percentage: utilization,
              onRent,
              available: counts["AVAILABLE"] ?? 0,
              reserved: counts["RESERVED"] ?? 0,
              down,
              total,
            },
          };
        },
      }),

      getRentalHistory: tool({
        description:
          "Get rental history records. Optionally filter by equipment ID to see history for a specific unit.",
        parameters: z.object({
          equipment_id: z
            .number()
            .optional()
            .describe("Filter to a specific equipment ID (optional)"),
          limit: z
            .number()
            .optional()
            .default(20)
            .describe("Max records to return (default 20)"),
        }),
        execute: async ({ equipment_id, limit }) => {
          const supabase = getSupabase();
          let query = supabase
            .from("rental_history")
            .select(
              `equipment_id, status_after, customer_name, job_po_notes,
               rate_type, rental_start, rental_end, revenue_amount, recorded_at,
               equipment ( gl_code, equipment_name )`
            )
            .order("recorded_at", { ascending: false })
            .limit(limit ?? 20);

          if (equipment_id) {
            query = query.eq("equipment_id", equipment_id);
          }

          const { data, error } = await query;
          if (error) return { error: error.message };
          return data ?? [];
        },
      }),

      getMaintenanceLogs: tool({
        description:
          "Get maintenance log records. Optionally filter by equipment ID or category.",
        parameters: z.object({
          equipment_id: z
            .number()
            .optional()
            .describe("Filter to a specific equipment ID (optional)"),
          category: z
            .string()
            .optional()
            .describe("Filter by category e.g. Repair, Preventive, Tires (optional)"),
          limit: z
            .number()
            .optional()
            .default(20)
            .describe("Max records to return (default 20)"),
        }),
        execute: async ({ equipment_id, category, limit }) => {
          const supabase = getSupabase();
          let query = supabase
            .from("maintenance_logs")
            .select(
              `equipment_id, date, cost, description, vendor, category, invoice_number,
               equipment ( gl_code, equipment_name )`
            )
            .order("date", { ascending: false })
            .limit(limit ?? 20);

          if (equipment_id) query = query.eq("equipment_id", equipment_id);
          if (category) query = query.eq("category", category);

          const { data, error } = await query;
          if (error) return { error: error.message };
          return data ?? [];
        },
      }),

      searchEquipment: tool({
        description:
          "Search for equipment by name or GL code. Use this when the user mentions a specific machine by name.",
        parameters: z.object({
          query: z.string().describe("Search term — equipment name or GL code"),
        }),
        execute: async ({ query }) => {
          const supabase = getSupabase();
          const { data, error } = await supabase
            .from("equipment")
            .select(
              `id, gl_code, equipment_name, division_id,
               divisions ( name ),
               equipment_status ( status, customer_name, rental_start, rental_end )`
            )
            .or(`equipment_name.ilike.%${query}%,gl_code.ilike.%${query}%`)
            .limit(10);
          if (error) return { error: error.message };
          return data ?? [];
        },
      }),

      // --- QuickBooks tools ---

      getAccountingOverview: tool({
        description:
          "Get a high-level accounting overview from QuickBooks: P&L summary, balance sheet totals, AR/AP totals. Use for general financial health questions.",
        parameters: z.object({}),
        execute: async () => {
          if (!(await isQBConnected())) return { error: "QuickBooks is not connected. Ask the user to connect on the Accounting page." };
          try {
            const [pnl, bs, ar, ap] = await Promise.all([
              fetchProfitAndLoss(),
              fetchBalanceSheet(),
              fetchAgedReceivables(),
              fetchAgedPayables(),
            ]);
            const totalAR = ar.reduce((s, r) => s + r.total, 0);
            const totalAP = ap.reduce((s, r) => s + r.total, 0);
            return {
              profitAndLoss: { period: pnl.period, totalIncome: pnl.totalIncome, totalExpenses: pnl.totalExpenses + pnl.totalCOGS, netIncome: pnl.netIncome },
              balanceSheet: { asOf: bs.asOf, totalAssets: bs.totalAssets, totalLiabilities: bs.totalLiabilities, totalEquity: bs.totalEquity },
              accountsReceivable: totalAR,
              accountsPayable: totalAP,
            };
          } catch (e: any) { return { error: e.message }; }
        },
      }),

      getProfitAndLoss: tool({
        description:
          "Get detailed Profit & Loss report from QuickBooks for a given period.",
        parameters: z.object({
          start_date: z.string().optional().describe("Start date YYYY-MM-DD (defaults to start of year)"),
          end_date: z.string().optional().describe("End date YYYY-MM-DD (defaults to today)"),
        }),
        execute: async ({ start_date, end_date }) => {
          if (!(await isQBConnected())) return { error: "QuickBooks not connected." };
          try { return await fetchProfitAndLoss(start_date, end_date); }
          catch (e: any) { return { error: e.message }; }
        },
      }),

      getBalanceSheet: tool({
        description:
          "Get Balance Sheet from QuickBooks showing assets, liabilities, and equity.",
        parameters: z.object({
          as_of: z.string().optional().describe("Date YYYY-MM-DD (defaults to today)"),
        }),
        execute: async ({ as_of }) => {
          if (!(await isQBConnected())) return { error: "QuickBooks not connected." };
          try { return await fetchBalanceSheet(as_of); }
          catch (e: any) { return { error: e.message }; }
        },
      }),

      getInvoices: tool({
        description:
          "Get invoices from QuickBooks. Can filter by status (open, overdue, paid, all).",
        parameters: z.object({
          status: z.enum(["open", "overdue", "paid", "all"]).optional().describe("Filter by status (default: all)"),
        }),
        execute: async ({ status }) => {
          if (!(await isQBConnected())) return { error: "QuickBooks not connected." };
          try { return await fetchInvoices(status ?? "all"); }
          catch (e: any) { return { error: e.message }; }
        },
      }),

      getAccountsReceivable: tool({
        description:
          "Get accounts receivable aging report from QuickBooks. Shows who owes money and how long outstanding.",
        parameters: z.object({}),
        execute: async () => {
          if (!(await isQBConnected())) return { error: "QuickBooks not connected." };
          try { return await fetchAgedReceivables(); }
          catch (e: any) { return { error: e.message }; }
        },
      }),

      getAccountsPayable: tool({
        description:
          "Get accounts payable aging report from QuickBooks with outstanding bills.",
        parameters: z.object({}),
        execute: async () => {
          if (!(await isQBConnected())) return { error: "QuickBooks not connected." };
          try { return await fetchAgedPayables(); }
          catch (e: any) { return { error: e.message }; }
        },
      }),

      // --- Telematics tools ---

      getTelematicsAlerts: tool({
        description:
          "Get telematics data from Cat VisionLink: engine hours, fault codes, GPS locations, fuel levels, idle time for all connected equipment. Use for questions about equipment health, fault codes, alerts, GPS location, or utilization.",
        parameters: z.object({}),
        execute: async () => {
          if (!isVisionLinkConfigured()) return { error: "VisionLink is not configured." };
          try {
            const data = await fetchFleetTelematics();
            const faults = data.assets.filter((a) => a.faultCodes.length > 0);
            return {
              totalAssets: data.assets.length,
              assetsWithFaults: faults.length,
              totalFaultCodes: faults.reduce((s, a) => s + a.faultCodes.length, 0),
              faults: faults.map((a) => ({
                equipmentId: a.equipmentId,
                serialNumber: a.serialNumber,
                make: a.make,
                model: a.model,
                faultCodes: a.faultCodes,
              })),
              assets: data.assets.map((a) => ({
                equipmentId: a.equipmentId,
                serialNumber: a.serialNumber,
                make: a.make,
                model: a.model,
                cumulativeHours: a.cumulativeHours,
                idleHours: a.idleHours,
                fuelRemainingPercent: a.fuelRemainingPercent,
                latitude: a.latitude,
                longitude: a.longitude,
                faultCount: a.faultCodes.length,
                lastCommunication: a.lastCommunication,
              })),
            };
          } catch (e: any) { return { error: e.message }; }
        },
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
