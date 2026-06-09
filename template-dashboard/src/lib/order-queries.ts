import { createServerSupabaseClient } from "./supabase";

export type OrderStatus = "upcoming" | "active" | "completed" | "cancelled";
export type OrderSource = "operator" | "web" | "voice";

export interface OrderRow {
  id: number;
  customer_id: number;
  customer_name: string;
  status: OrderStatus;
  source: OrderSource;
  rental_start: string;
  rental_end: string;
  total: number | null;
  asset_count: number;
  created_at: string;
}

interface RawOrder {
  id: number;
  customer_id: number;
  status: OrderStatus;
  source: OrderSource;
  rental_start: string;
  rental_end: string;
  total: number | null;
  created_at: string;
  customers: { name: string } | null;
  order_lines: { id: number }[] | null;
}

function mapOrder(r: RawOrder): OrderRow {
  return {
    id: r.id,
    customer_id: r.customer_id,
    customer_name: r.customers?.name ?? "Customer",
    status: r.status,
    source: r.source,
    rental_start: r.rental_start,
    rental_end: r.rental_end,
    total: r.total,
    asset_count: r.order_lines?.length ?? 0,
    created_at: r.created_at,
  };
}

export interface ListOrdersOpts {
  status?: OrderStatus;
  customerId?: number;
  limit?: number;
}

export async function listOrders(companyId: number, opts: ListOrdersOpts = {}): Promise<OrderRow[]> {
  const supabase = createServerSupabaseClient();
  let q = supabase
    .from("orders")
    .select(`
      id, customer_id, status, source, rental_start, rental_end, total, created_at,
      customers ( name ),
      order_lines ( id )
    `)
    .eq("company_id", companyId)
    .order("rental_start", { ascending: false })
    .limit(opts.limit ?? 200);

  if (opts.status) q = q.eq("status", opts.status);
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as RawOrder[]).map(mapOrder);
}

export async function countOrdersByStatus(companyId: number): Promise<Record<OrderStatus, number>> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("company_id", companyId);
  const out: Record<OrderStatus, number> = { upcoming: 0, active: 0, completed: 0, cancelled: 0 };
  if (error || !data) return out;
  for (const row of data as { status: OrderStatus }[]) {
    if (out[row.status] != null) out[row.status]++;
  }
  return out;
}

export interface OrderLineDetail {
  id: number;
  equipment_id: number;
  gl_code: string;
  equipment_name: string;
  rate_type: string;
  rate_amount: number | null;
  line_total: number | null;
}

export interface OrderDetail {
  id: number;
  status: OrderStatus;
  source: OrderSource;
  rental_start: string;
  rental_end: string;
  total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
  lines: OrderLineDetail[];
}

export async function getOrderDetail(companyId: number, id: number): Promise<OrderDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data: orderRow, error } = await supabase
    .from("orders")
    .select(`
      id, status, source, rental_start, rental_end, total, notes, created_at, updated_at,
      customers ( id, name, email, phone, company )
    `)
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();

  if (error || !orderRow) return null;

  const o = orderRow as unknown as {
    id: number;
    status: OrderStatus;
    source: OrderSource;
    rental_start: string;
    rental_end: string;
    total: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    customers: {
      id: number;
      name: string;
      email: string | null;
      phone: string | null;
      company: string | null;
    } | null;
  };

  if (!o.customers) return null;

  const { data: lineRows } = await supabase
    .from("order_lines")
    .select(`
      id, equipment_id, rate_type, rate_amount, line_total,
      equipment ( gl_code, equipment_name )
    `)
    .eq("company_id", companyId)
    .eq("order_id", id)
    .order("id", { ascending: true });

  const lines: OrderLineDetail[] = ((lineRows ?? []) as unknown as Array<{
    id: number;
    equipment_id: number;
    rate_type: string;
    rate_amount: number | null;
    line_total: number | null;
    equipment: { gl_code: string; equipment_name: string } | null;
  }>).map((r) => ({
    id: r.id,
    equipment_id: r.equipment_id,
    gl_code: r.equipment?.gl_code ?? "",
    equipment_name: r.equipment?.equipment_name ?? "",
    rate_type: r.rate_type,
    rate_amount: r.rate_amount,
    line_total: r.line_total,
  }));

  return {
    id: o.id,
    status: o.status,
    source: o.source,
    rental_start: o.rental_start,
    rental_end: o.rental_end,
    total: o.total,
    notes: o.notes,
    created_at: o.created_at,
    updated_at: o.updated_at,
    customer: o.customers,
    lines,
  };
}
