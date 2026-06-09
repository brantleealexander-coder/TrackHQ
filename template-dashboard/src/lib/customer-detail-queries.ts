import { createServerSupabaseClient } from "./supabase";

export interface CustomerProfile {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerOrderRow {
  id: number;
  status: string;
  rental_start: string;
  rental_end: string;
  total: number | null;
  asset_count: number;
}

export interface CustomerProfileWithOrders extends CustomerProfile {
  orders: CustomerOrderRow[];
  lifetime_revenue: number;
}

export async function getCustomerProfile(companyId: number, id: number): Promise<CustomerProfileWithOrders | null> {
  const supabase = createServerSupabaseClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, company, address, notes, created_at")
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error || !customer) return null;

  const { data: orderRows } = await supabase
    .from("orders")
    .select(`
      id, status, rental_start, rental_end, total,
      order_lines ( id )
    `)
    .eq("company_id", companyId)
    .eq("customer_id", id)
    .order("rental_start", { ascending: false });

  const orders: CustomerOrderRow[] = ((orderRows ?? []) as unknown as Array<{
    id: number;
    status: string;
    rental_start: string;
    rental_end: string;
    total: number | null;
    order_lines: { id: number }[] | null;
  }>).map((o) => ({
    id: o.id,
    status: o.status,
    rental_start: o.rental_start,
    rental_end: o.rental_end,
    total: o.total,
    asset_count: o.order_lines?.length ?? 0,
  }));

  const lifetimeRevenue = orders
    .filter((o) => o.status === "completed" || o.status === "active")
    .reduce((s, o) => s + (o.total ?? 0), 0);

  return {
    ...(customer as CustomerProfile),
    orders,
    lifetime_revenue: lifetimeRevenue,
  };
}
