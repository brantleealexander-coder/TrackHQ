import { createServerSupabaseClient } from "./supabase";

export interface CalendarOrder {
  id: number;
  status: string;
  rental_start: string;
  rental_end: string;
  customer_name: string;
  asset_count: number;
  total: number | null;
}

export interface CalendarPending {
  id: number;
  rental_start: string;
  rental_end: string;
  customer_name: string;
  equipment_name: string;
  source: string;
}

export interface CalendarData {
  orders: CalendarOrder[];
  pending: CalendarPending[];
}

interface OrderRow {
  id: number;
  status: string;
  rental_start: string;
  rental_end: string;
  total: number | null;
  customers: { name: string } | null;
  order_lines: { id: number }[] | null;
}

interface PendingRow {
  id: number;
  renter_name: string | null;
  rental_start: string;
  rental_end: string;
  source: string;
  equipment: { equipment_name: string | null } | null;
  customers: { name: string | null } | null;
}

export async function getCalendarData(
  companyId: number,
  from: string,
  to: string
): Promise<CalendarData> {
  const supabase = createServerSupabaseClient();

  const [ordersRes, pendingRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, status, rental_start, rental_end, total,
         customers ( name ),
         order_lines ( id )`
      )
      .eq("company_id", companyId)
      .lte("rental_start", to)
      .gte("rental_end", from)
      .neq("status", "cancelled")
      .order("rental_start", { ascending: true }),
    supabase
      .from("booking_requests")
      .select(
        `id, renter_name, rental_start, rental_end, source,
         equipment ( equipment_name ),
         customers ( name )`
      )
      .eq("company_id", companyId)
      .eq("status", "pending")
      .lte("rental_start", to)
      .gte("rental_end", from)
      .order("rental_start", { ascending: true }),
  ]);

  const orders: CalendarOrder[] = !ordersRes.error && ordersRes.data
    ? (ordersRes.data as unknown as OrderRow[]).map((row) => ({
        id: row.id,
        status: row.status,
        rental_start: row.rental_start,
        rental_end: row.rental_end,
        customer_name: row.customers?.name ?? "Customer",
        asset_count: row.order_lines?.length ?? 0,
        total: row.total,
      }))
    : [];

  const pending: CalendarPending[] = !pendingRes.error && pendingRes.data
    ? (pendingRes.data as unknown as PendingRow[]).map((row) => ({
        id: row.id,
        rental_start: row.rental_start,
        rental_end: row.rental_end,
        customer_name: row.customers?.name ?? row.renter_name ?? "Caller",
        equipment_name: row.equipment?.equipment_name ?? "Asset",
        source: row.source,
      }))
    : [];

  return { orders, pending };
}

/** Back-compat shim — used by the dashboard 'recent activity' code path. */
export async function getCalendarOrders(
  companyId: number,
  from: string,
  to: string
): Promise<CalendarOrder[]> {
  return (await getCalendarData(companyId, from, to)).orders;
}
