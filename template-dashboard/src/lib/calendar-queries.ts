import { createServerSupabaseClient } from "./supabase";

// Public-facing shape passed to the client calendar component.
export interface CalendarOrder {
  id: number;
  status: string; // upcoming | active | completed | cancelled
  rental_start: string; // YYYY-MM-DD
  rental_end: string;
  customer_name: string;
  asset_count: number;
  total: number | null;
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

// Orders intersecting [from, to]. We want anything whose date range
// touches the window — i.e. starts before `to` AND ends on/after `from`.
export async function getCalendarOrders(
  from: string,
  to: string
): Promise<CalendarOrder[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, status, rental_start, rental_end, total,
      customers ( name ),
      order_lines ( id )
    `)
    .lte("rental_start", to)
    .gte("rental_end", from)
    .neq("status", "cancelled")
    .order("rental_start", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as OrderRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    rental_start: row.rental_start,
    rental_end: row.rental_end,
    customer_name: row.customers?.name ?? "Customer",
    asset_count: row.order_lines?.length ?? 0,
    total: row.total,
  }));
}
