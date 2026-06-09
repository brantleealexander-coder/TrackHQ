import { createServerSupabaseClient } from "./supabase";
import type { Status } from "./types";

export interface DashboardKpis {
  activeRentalsCount: number;
  pendingRequestsCount: number;
  monthRevenue: number;
  prevMonthRevenue: number;
  momChangePct: number | null;
}

export interface DashboardAlert {
  kind: "overdue" | "request" | "down";
  title: string;
  detail: string;
  href: string;
}

export interface ActivityEvent {
  kind: "order_created" | "request_received" | "rental_closed";
  at: string;
  title: string;
  detail: string;
  href?: string;
}

function monthRange(offsetMonths: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function getDashboardKpis(companyId: number, statuses: Status[]): Promise<DashboardKpis> {
  const supabase = createServerSupabaseClient();
  const rentedKeys = statuses.filter((s) => s.behavior === "rented").map((s) => s.key);

  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);

  const [activeRes, pendingRes, monthRes, prevMonthRes] = await Promise.all([
    rentedKeys.length > 0
      ? supabase
          .from("equipment_status")
          .select("equipment_id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .in("status", rentedKeys)
      : Promise.resolve({ count: 0, error: null }),
    supabase
      .from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending"),
    supabase
      .from("rental_history")
      .select("revenue_amount")
      .eq("company_id", companyId)
      .gte("rental_start", thisMonth.start)
      .lt("rental_start", thisMonth.end),
    supabase
      .from("rental_history")
      .select("revenue_amount")
      .eq("company_id", companyId)
      .gte("rental_start", lastMonth.start)
      .lt("rental_start", lastMonth.end),
  ]);

  const monthRevenue = (monthRes.data ?? []).reduce(
    (s, r) => s + (Number(r.revenue_amount) || 0),
    0
  );
  const prevMonthRevenue = (prevMonthRes.data ?? []).reduce(
    (s, r) => s + (Number(r.revenue_amount) || 0),
    0
  );
  const momChangePct =
    prevMonthRevenue > 0
      ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : null;

  return {
    activeRentalsCount: activeRes.count ?? 0,
    pendingRequestsCount: pendingRes.count ?? 0,
    monthRevenue,
    prevMonthRevenue,
    momChangePct,
  };
}

export async function getDashboardAlerts(companyId: number, statuses: Status[]): Promise<DashboardAlert[]> {
  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const rentedKeys = statuses.filter((s) => s.behavior === "rented").map((s) => s.key);
  const downKeys = statuses.filter((s) => s.behavior === "out_of_service").map((s) => s.key);

  const [overdueRes, pendingRes, downRes] = await Promise.all([
    rentedKeys.length > 0
      ? supabase
          .from("equipment_status")
          .select("equipment_id, customer_name, rental_end, equipment(gl_code, equipment_name)")
          .eq("company_id", companyId)
          .in("status", rentedKeys)
          .not("rental_end", "is", null)
          .lt("rental_end", today)
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("booking_requests")
      .select("id, renter_name, equipment(equipment_name)")
      .eq("company_id", companyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    downKeys.length > 0
      ? supabase
          .from("equipment_status")
          .select("equipment_id, equipment(gl_code, equipment_name)")
          .eq("company_id", companyId)
          .in("status", downKeys)
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const alerts: DashboardAlert[] = [];

  for (const row of (overdueRes.data ?? []) as unknown as Array<{
    equipment_id: number;
    customer_name: string | null;
    rental_end: string | null;
    equipment: { gl_code: string; equipment_name: string } | null;
  }>) {
    const days = row.rental_end
      ? Math.ceil((new Date(today).getTime() - new Date(row.rental_end).getTime()) / 86_400_000)
      : 0;
    alerts.push({
      kind: "overdue",
      title: `${row.equipment?.equipment_name ?? "Unit"} is ${days}d overdue`,
      detail: row.customer_name ? `Customer: ${row.customer_name}` : `GL ${row.equipment?.gl_code ?? ""}`,
      href: `/app/fleet/${row.equipment_id}`,
    });
  }

  for (const row of (pendingRes.data ?? []) as unknown as Array<{
    id: number;
    renter_name: string;
    equipment: { equipment_name: string } | null;
  }>) {
    alerts.push({
      kind: "request",
      title: `New booking request from ${row.renter_name}`,
      detail: row.equipment?.equipment_name ?? "",
      href: `/app/orders`,
    });
  }

  for (const row of (downRes.data ?? []) as unknown as Array<{
    equipment_id: number;
    equipment: { gl_code: string; equipment_name: string } | null;
  }>) {
    alerts.push({
      kind: "down",
      title: `${row.equipment?.equipment_name ?? "Unit"} is out of service`,
      detail: `GL ${row.equipment?.gl_code ?? ""}`,
      href: `/app/fleet/${row.equipment_id}`,
    });
  }

  return alerts;
}

export async function getRecentActivity(companyId: number, limit = 15): Promise<ActivityEvent[]> {
  const supabase = createServerSupabaseClient();

  const [ordersRes, requestsRes, historyRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, total, created_at, customers(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("booking_requests")
      .select("id, renter_name, source, created_at, equipment(equipment_name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("rental_history")
      .select("id, customer_name, revenue_amount, recorded_at, equipment(equipment_name)")
      .eq("company_id", companyId)
      .order("recorded_at", { ascending: false })
      .limit(limit),
  ]);

  const events: ActivityEvent[] = [];

  for (const row of (ordersRes.data ?? []) as unknown as Array<{
    id: number;
    status: string;
    total: number | null;
    created_at: string;
    customers: { name: string } | null;
  }>) {
    events.push({
      kind: "order_created",
      at: row.created_at,
      title: `Order #${row.id} · ${row.customers?.name ?? "Customer"}`,
      detail: `${row.status}${row.total != null ? ` · $${Math.round(row.total).toLocaleString()}` : ""}`,
      href: `/app/orders/${row.id}`,
    });
  }

  for (const row of (requestsRes.data ?? []) as unknown as Array<{
    id: number;
    renter_name: string;
    source: string;
    created_at: string;
    equipment: { equipment_name: string } | null;
  }>) {
    events.push({
      kind: "request_received",
      at: row.created_at,
      title: `${row.source === "voice" ? "Voice" : "Web"} request from ${row.renter_name}`,
      detail: row.equipment?.equipment_name ?? "",
      href: `/app/orders`,
    });
  }

  for (const row of (historyRes.data ?? []) as unknown as Array<{
    id: number;
    customer_name: string | null;
    revenue_amount: number | null;
    recorded_at: string;
    equipment: { equipment_name: string } | null;
  }>) {
    events.push({
      kind: "rental_closed",
      at: row.recorded_at,
      title: `Closed: ${row.equipment?.equipment_name ?? "Unit"}`,
      detail: `${row.customer_name ?? "Customer"}${row.revenue_amount ? ` · $${Math.round(Number(row.revenue_amount)).toLocaleString()}` : ""}`,
    });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  return events.slice(0, limit);
}
