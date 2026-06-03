import { createServerSupabaseClient } from "./supabase";

export interface CustomerRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}

export interface CustomerWithStats extends CustomerRow {
  active_orders: number;
  total_orders: number;
  last_rental_date: string | null;
}

export async function searchCustomers(query: string, limit = 8): Promise<CustomerRow[]> {
  const supabase = createServerSupabaseClient();
  const trimmed = query.trim();
  let q = supabase
    .from("customers")
    .select("id, name, email, phone, company")
    .order("name", { ascending: true })
    .limit(limit);

  if (trimmed.length > 0) {
    // Postgrest 'or' with multiple ilike clauses
    const term = `%${trimmed.replace(/[%_]/g, "")}%`;
    q = q.or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term},company.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return data as CustomerRow[];
}

export async function getCustomer(id: number): Promise<CustomerRow | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, email, phone, company")
    .eq("id", id)
    .maybeSingle();
  return (data as CustomerRow | null) ?? null;
}

export async function listCustomersWithStats(): Promise<CustomerWithStats[]> {
  const supabase = createServerSupabaseClient();
  const [customersRes, ordersRes] = await Promise.all([
    supabase.from("customers").select("id, name, email, phone, company").order("name"),
    supabase
      .from("orders")
      .select("customer_id, status, rental_start"),
  ]);

  const customers = (customersRes.data ?? []) as CustomerRow[];
  const orders = ((ordersRes.data ?? []) as Array<{
    customer_id: number;
    status: string;
    rental_start: string;
  }>) ?? [];

  const stats = new Map<
    number,
    { active: number; total: number; lastStart: string | null }
  >();
  for (const c of customers) {
    stats.set(c.id, { active: 0, total: 0, lastStart: null });
  }
  for (const o of orders) {
    const s = stats.get(o.customer_id);
    if (!s) continue;
    s.total++;
    if (o.status === "active") s.active++;
    if (!s.lastStart || o.rental_start > s.lastStart) s.lastStart = o.rental_start;
  }

  return customers.map((c) => {
    const s = stats.get(c.id) ?? { active: 0, total: 0, lastStart: null };
    return {
      ...c,
      active_orders: s.active,
      total_orders: s.total,
      last_rental_date: s.lastStart,
    };
  });
}
