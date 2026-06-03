import { createServerSupabaseClient } from "./supabase";
import type { OrderStatus, OrderSource } from "./order-queries";

export interface NewOrderLineInput {
  equipment_id: number;
  rate_type: "daily" | "weekly" | "monthly";
  rate_amount: number;
  line_total: number;
}

export interface NewOrderInput {
  customer_id: number;
  rental_start: string; // YYYY-MM-DD
  rental_end: string;
  notes?: string | null;
  source?: OrderSource;
  status?: Exclude<OrderStatus, "cancelled">; // operator can pre-mark upcoming/active
  lines: NewOrderLineInput[];
}

export interface CreatedOrder {
  id: number;
  total: number;
}

// Best-effort transactional create: insert order, insert lines, flip
// equipment_status to 'on_rent' for each asset when the order is active.
// If a stage fails, we attempt to roll back the order row.
export async function createOrder(input: NewOrderInput): Promise<CreatedOrder> {
  if (input.lines.length === 0) {
    throw new Error("Order must have at least one line");
  }
  const supabase = createServerSupabaseClient();

  const total = input.lines.reduce((s, l) => s + (l.line_total || 0), 0);
  const status = input.status ?? "upcoming";
  const source = input.source ?? "operator";

  // 1. Order header
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_id: input.customer_id,
      status,
      rental_start: input.rental_start,
      rental_end: input.rental_end,
      total,
      source,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    throw new Error(`createOrder: ${orderErr?.message ?? "no row returned"}`);
  }

  const orderId = order.id as number;

  // 2. Order lines
  const { error: linesErr } = await supabase.from("order_lines").insert(
    input.lines.map((l) => ({
      order_id: orderId,
      equipment_id: l.equipment_id,
      rate_type: l.rate_type,
      rate_amount: l.rate_amount,
      line_total: l.line_total,
    }))
  );

  if (linesErr) {
    await supabase.from("orders").delete().eq("id", orderId);
    throw new Error(`createOrder lines: ${linesErr.message}`);
  }

  // 3. Flip equipment_status to on_rent for active orders. We look up the
  //    tenant's status keys to find the canonical 'rented' status.
  if (status === "active") {
    await flipEquipmentStatuses(
      supabase,
      input.lines.map((l) => l.equipment_id),
      "rented",
      input.customer_id,
      input.rental_start,
      input.rental_end
    );
  }

  return { id: orderId, total };
}

async function flipEquipmentStatuses(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  equipmentIds: number[],
  targetBehavior: "rented" | "available",
  customerId: number | null,
  rentalStart: string | null,
  rentalEnd: string | null
): Promise<void> {
  const { data: statuses } = await supabase
    .from("statuses")
    .select("key, behavior")
    .eq("behavior", targetBehavior)
    .limit(1);

  const statusKey = statuses?.[0]?.key as string | undefined;
  if (!statusKey) return; // tenant has no status with this behavior; skip

  let customerName: string | null = null;
  if (customerId != null) {
    const { data: c } = await supabase
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .maybeSingle();
    customerName = (c?.name as string | undefined) ?? null;
  }

  await supabase.from("equipment_status").upsert(
    equipmentIds.map((eq) => ({
      equipment_id: eq,
      status: statusKey,
      customer_name: customerName,
      rental_start: rentalStart,
      rental_end: rentalEnd,
    })),
    { onConflict: "equipment_id" }
  );
}

export async function updateOrderStatus(
  id: number,
  newStatus: OrderStatus
): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { data: orderRow, error } = await supabase
    .from("orders")
    .select("id, status, customer_id, rental_start, rental_end")
    .eq("id", id)
    .maybeSingle();
  if (error || !orderRow) throw new Error(`updateOrderStatus: order not found`);

  const { data: lineRows } = await supabase
    .from("order_lines")
    .select("equipment_id")
    .eq("order_id", id);
  const equipmentIds = (lineRows ?? []).map((r) => r.equipment_id as number);

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) throw new Error(`updateOrderStatus: ${updErr.message}`);

  // Sync equipment_status side-effects
  if (newStatus === "active") {
    await flipEquipmentStatuses(
      supabase,
      equipmentIds,
      "rented",
      orderRow.customer_id as number,
      orderRow.rental_start as string,
      orderRow.rental_end as string
    );
  } else if (newStatus === "completed" || newStatus === "cancelled") {
    await flipEquipmentStatuses(supabase, equipmentIds, "available", null, null, null);

    if (newStatus === "completed") {
      // Append a rental_history row per line so closed-rental revenue reports stay populated.
      await appendRentalHistory(supabase, id);
    }
  }
}

async function appendRentalHistory(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  orderId: number
): Promise<void> {
  const { data: detail } = await supabase
    .from("orders")
    .select(`
      rental_start, rental_end,
      customers ( name ),
      order_lines ( equipment_id, rate_type, line_total )
    `)
    .eq("id", orderId)
    .maybeSingle();
  if (!detail) return;

  const d = detail as unknown as {
    rental_start: string;
    rental_end: string;
    customers: { name: string } | null;
    order_lines: { equipment_id: number; rate_type: string; line_total: number | null }[];
  };

  const rows = (d.order_lines ?? []).map((l) => ({
    equipment_id: l.equipment_id,
    status_before: "on_rent",
    status_after: "available",
    customer_name: d.customers?.name ?? null,
    rate_type: l.rate_type,
    rental_start: d.rental_start,
    rental_end: d.rental_end,
    revenue_amount: l.line_total,
    recorded_by: "operator",
  }));

  if (rows.length > 0) {
    await supabase.from("rental_history").insert(rows);
  }
}
