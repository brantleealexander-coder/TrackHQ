// QuickBooks Online API client — OAuth2, token management, cached data fetching
import { createServerSupabaseClient } from "./supabase";
import { parseProfitAndLoss, parseBalanceSheet, parseAgingReport } from "./qb-report-parser";
import type {
  QBTokens,
  ProfitAndLossData,
  BalanceSheetData,
  AgingRow,
  QBInvoice,
  QBBill,
  QBCustomer,
  QBVendor,
} from "./qb-types";

const INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const CACHE_TTL_MINUTES = 15;

function getBaseUrl(): string {
  return process.env.QB_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

// --- Token management ---

export async function getQBTokens(): Promise<QBTokens | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("qb_tokens")
    .select("realm_id, access_token, refresh_token, expires_at")
    .eq("id", 1)
    .single();

  if (error || !data) return null;
  return data as QBTokens;
}

export async function isQBConnected(): Promise<boolean> {
  const tokens = await getQBTokens();
  return tokens !== null;
}

async function refreshAccessToken(tokens: QBTokens): Promise<QBTokens> {
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(INTUIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // If refresh fails, delete tokens so UI shows reconnect prompt
    const supabase = createServerSupabaseClient();
    await supabase.from("qb_tokens").delete().eq("id", 1);
    throw new Error(`Token refresh failed: ${text}`);
  }

  const body = await res.json();
  const expiresAt = new Date(Date.now() + body.expires_in * 1000).toISOString();

  const updated: QBTokens = {
    realm_id: tokens.realm_id,
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? tokens.refresh_token,
    expires_at: expiresAt,
  };

  const supabase = createServerSupabaseClient();
  await supabase
    .from("qb_tokens")
    .update({
      access_token: updated.access_token,
      refresh_token: updated.refresh_token,
      expires_at: updated.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return updated;
}

async function getValidTokens(): Promise<QBTokens> {
  let tokens = await getQBTokens();
  if (!tokens) throw new Error("QuickBooks not connected");

  // Refresh if expiring within 5 minutes
  const expiresAt = new Date(tokens.expires_at).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    tokens = await refreshAccessToken(tokens);
  }

  return tokens;
}

// --- Raw API fetch ---

async function qbFetch(path: string, params?: Record<string, string>): Promise<any> {
  const tokens = await getValidTokens();
  const url = new URL(`${getBaseUrl()}/v3/company/${tokens.realm_id}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    // Try one refresh and retry
    const refreshed = await refreshAccessToken(tokens);
    const retry = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${refreshed.access_token}`,
        Accept: "application/json",
      },
    });
    if (!retry.ok) throw new Error(`QB API error: ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`QB API error: ${res.status}`);
  return res.json();
}

// --- Cache layer ---

async function qbFetchCached(cacheKey: string, fetcher: () => Promise<any>): Promise<any> {
  const supabase = createServerSupabaseClient();

  // Check cache
  const { data: cached } = await supabase
    .from("qb_cache")
    .select("data, fetched_at")
    .eq("cache_key", cacheKey)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MINUTES * 60 * 1000) {
      return cached.data;
    }
  }

  // Cache miss or stale
  const fresh = await fetcher();

  await supabase.from("qb_cache").upsert({
    cache_key: cacheKey,
    data: fresh,
    fetched_at: new Date().toISOString(),
  });

  return fresh;
}

// --- Report fetchers ---

export async function fetchProfitAndLoss(
  startDate?: string,
  endDate?: string
): Promise<ProfitAndLossData> {
  const now = new Date();
  const start = startDate ?? `${now.getFullYear()}-01-01`;
  const end = endDate ?? now.toISOString().split("T")[0];
  const key = `pnl:${start}:${end}`;

  const raw = await qbFetchCached(key, () =>
    qbFetch("/reports/ProfitAndLoss", {
      start_date: start,
      end_date: end,
      minorversion: "65",
    })
  );

  return parseProfitAndLoss(raw);
}

export async function fetchBalanceSheet(asOf?: string): Promise<BalanceSheetData> {
  const date = asOf ?? new Date().toISOString().split("T")[0];
  const key = `bs:${date}`;

  const raw = await qbFetchCached(key, () =>
    qbFetch("/reports/BalanceSheet", {
      date_macro: "", // clear any macro
      start_date: date,
      end_date: date,
      minorversion: "65",
    })
  );

  return parseBalanceSheet(raw);
}

export async function fetchAgedReceivables(): Promise<AgingRow[]> {
  const raw = await qbFetchCached("ar-aging", () =>
    qbFetch("/reports/AgedReceivables", { minorversion: "65" })
  );
  return parseAgingReport(raw);
}

export async function fetchAgedPayables(): Promise<AgingRow[]> {
  const raw = await qbFetchCached("ap-aging", () =>
    qbFetch("/reports/AgedPayables", { minorversion: "65" })
  );
  return parseAgingReport(raw);
}

// --- Entity fetchers ---

export async function fetchInvoices(statusFilter?: string): Promise<QBInvoice[]> {
  const raw = await qbFetchCached("invoices", () =>
    qbFetch("/query", { query: "SELECT * FROM Invoice MAXRESULTS 1000", minorversion: "65" })
  );

  const today = new Date().toISOString().split("T")[0];
  const invoices: QBInvoice[] = (raw?.QueryResponse?.Invoice ?? []).map((inv: any) => {
    const balance = parseFloat(inv.Balance) || 0;
    const dueDate = inv.DueDate ?? "";
    let status: "paid" | "open" | "overdue" = "open";
    if (balance === 0) status = "paid";
    else if (dueDate && dueDate < today) status = "overdue";

    return {
      id: inv.Id,
      docNumber: inv.DocNumber ?? "",
      customerName: inv.CustomerRef?.name ?? "",
      txnDate: inv.TxnDate ?? "",
      dueDate,
      totalAmt: parseFloat(inv.TotalAmt) || 0,
      balance,
      status,
    };
  });

  if (statusFilter && statusFilter !== "all") {
    return invoices.filter((i) => i.status === statusFilter);
  }
  return invoices;
}

export async function fetchBills(): Promise<QBBill[]> {
  const raw = await qbFetchCached("bills", () =>
    qbFetch("/query", { query: "SELECT * FROM Bill MAXRESULTS 1000", minorversion: "65" })
  );

  return (raw?.QueryResponse?.Bill ?? []).map((bill: any) => ({
    id: bill.Id,
    vendorName: bill.VendorRef?.name ?? "",
    txnDate: bill.TxnDate ?? "",
    dueDate: bill.DueDate ?? "",
    totalAmt: parseFloat(bill.TotalAmt) || 0,
    balance: parseFloat(bill.Balance) || 0,
  }));
}

export async function fetchCustomers(): Promise<QBCustomer[]> {
  const raw = await qbFetchCached("customers", () =>
    qbFetch("/query", { query: "SELECT * FROM Customer MAXRESULTS 1000", minorversion: "65" })
  );

  return (raw?.QueryResponse?.Customer ?? []).map((c: any) => ({
    id: c.Id,
    displayName: c.DisplayName ?? "",
    balance: parseFloat(c.Balance) || 0,
    email: c.PrimaryEmailAddr?.Address,
    phone: c.PrimaryPhone?.FreeFormNumber,
  }));
}

export async function fetchVendors(): Promise<QBVendor[]> {
  const raw = await qbFetchCached("vendors", () =>
    qbFetch("/query", { query: "SELECT * FROM Vendor MAXRESULTS 1000", minorversion: "65" })
  );

  return (raw?.QueryResponse?.Vendor ?? []).map((v: any) => ({
    id: v.Id,
    displayName: v.DisplayName ?? "",
    balance: parseFloat(v.Balance) || 0,
  }));
}

export async function fetchCompanyInfo(): Promise<string> {
  const tokens = await getValidTokens();
  const raw = await qbFetch(`/companyinfo/${tokens.realm_id}`);
  return raw?.CompanyInfo?.CompanyName ?? "Unknown Company";
}
