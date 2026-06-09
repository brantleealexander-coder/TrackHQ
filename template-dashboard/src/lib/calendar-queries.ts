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

interface OrderRow {
  id: number;
  status: string;
  rental_start: string;
  rental_end: string;
  total: number | null;
  customers: { name: string } | null;
  order_lines: { id: number }[] | null;
}

export async function getCalendarOrders(
  companyId: number,
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
    .eq("company_id", companyId)
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
