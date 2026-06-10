import { createServerSupabaseClient } from "./supabase";
import { createOrder } from "./order-mutations";
import { sendBookingConfirmation } from "./email";
import { getTenantConfig } from "./tenant-config";

export interface ApprovedResult {
  order_id: number;
  total: number;
}

type RateType = "daily" | "weekly" | "monthly";

interface BookingRow {
  id: number;
  company_id: number;
  customer_id: number | null;
  renter_name: string | null;
  renter_email: string | null;
  renter_phone: string | null;
  equipment_id: number;
  rental_start: string;
  rental_end: string;
  rate_type: RateType | null;
  notes: string | null;
  status: string;
}

interface EquipmentRates {
  id: number;
  equipment_name: string;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const ms = e.getTime() - s.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

function pickRate(eq: EquipmentRates, rateType: RateType): number {
  if (rateType === "daily") return eq.rate_daily ?? 0;
  if (rateType === "weekly") return eq.rate_weekly ?? 0;
  return eq.rate_monthly ?? 0;
}

function lineTotal(rate: number, rateType: RateType, days: number): number {
  if (rateType === "daily") return rate * days;
  if (rateType === "weekly") return rate * Math.max(1, Math.ceil(days / 7));
  return rate * Math.max(1, Math.ceil(days / 28));
}

function defaultRateType(eq: EquipmentRates, days: number): RateType {
  if (days >= 28 && eq.rate_monthly != null) return "monthly";
  if (days >= 7 && eq.rate_weekly != null) return "weekly";
  if (eq.rate_daily != null) return "daily";
  if (eq.rate_weekly != null) return "weekly";
  return "monthly";
}

function deriveStatus(rentalStart: string, rentalEnd: string): "upcoming" | "active" | "completed" {
  const today = new Date().toISOString().slice(0, 10);
  if (today < rentalStart) return "upcoming";
  if (today > rentalEnd) return "completed";
  return "active";
}

/**
 * Approve a pending booking_request: create an order + line, flip equipment
 * status if needed, mark the request confirmed, and fire a customer email.
 *
 * Sequential writes with manual rollback if the order_lines insert fails
 * (createOrder handles that itself). Transactional integrity good enough
 * for v1; promote to a Postgres RPC if we ever see drift.
 */
export async function approveBookingRequest(
  companyId: number,
  bookingRequestId: number
): Promise<ApprovedResult> {
  const supabase = createServerSupabaseClient();

  const { data: brData, error: brErr } = await supabase
    .from("booking_requests")
    .select(
      "id, company_id, customer_id, renter_name, renter_email, renter_phone, equipment_id, rental_start, rental_end, rate_type, notes, status"
    )
    .eq("company_id", companyId)
    .eq("id", bookingRequestId)
    .maybeSingle();

  if (brErr || !brData) throw new Error("Booking request not found");
  const br = brData as unknown as BookingRow;
  if (br.status !== "pending") {
    throw new Error(`Booking request already ${br.status}`);
  }

  let customerId = br.customer_id;
  if (!customerId) {
    customerId = await ensureCustomer(supabase, companyId, {
      name: br.renter_name ?? "Caller",
      email: br.renter_email,
      phone: br.renter_phone,
    });
  }

  const { data: eqRow, error: eqErr } = await supabase
    .from("equipment")
    .select("id, equipment_name, rate_daily, rate_weekly, rate_monthly")
    .eq("company_id", companyId)
    .eq("id", br.equipment_id)
    .maybeSingle();
  if (eqErr || !eqRow) throw new Error("Equipment not found");
  const eq = eqRow as unknown as EquipmentRates;

  const days = daysBetween(br.rental_start, br.rental_end);
  const rateType: RateType = br.rate_type ?? defaultRateType(eq, days);
  const rate = pickRate(eq, rateType);
  const total = lineTotal(rate, rateType, days);
  const orderStatus = deriveStatus(br.rental_start, br.rental_end);

  const created = await createOrder(companyId, {
    customer_id: customerId,
    rental_start: br.rental_start,
    rental_end: br.rental_end,
    notes: br.notes ?? null,
    source: "voice",
    status: orderStatus,
    booking_request_id: br.id,
    lines: [
      {
        equipment_id: br.equipment_id,
        rate_type: rateType,
        rate_amount: rate,
        line_total: total,
      },
    ],
  });

  await supabase
    .from("booking_requests")
    .update({ status: "confirmed" })
    .eq("company_id", companyId)
    .eq("id", br.id);

  // Fire-and-forget: never block the operator on email delivery.
  if (br.renter_email) {
    const cfg = getTenantConfig();
    void sendBookingConfirmation({
      to: br.renter_email,
      business_name: cfg.business.name,
      customer_name: br.renter_name ?? "there",
      asset_name: eq.equipment_name,
      rental_start: br.rental_start,
      rental_end: br.rental_end,
      total: created.total,
      ref_number: `#${String(created.id).padStart(6, "0")}`,
    }).catch((e) => {
      console.error("[booking-confirm] email failed:", e);
    });
  }

  return { order_id: created.id, total: created.total };
}

export async function rejectBookingRequest(
  companyId: number,
  bookingRequestId: number
): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("booking_requests")
    .update({ status: "rejected" })
    .eq("company_id", companyId)
    .eq("id", bookingRequestId)
    .eq("status", "pending");
  if (error) throw new Error(`reject: ${error.message}`);
}

async function ensureCustomer(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  companyId: number,
  contact: { name: string; email: string | null; phone: string | null }
): Promise<number> {
  if (contact.email) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .ilike("email", contact.email)
      .limit(1);
    if (data && data.length > 0) return data[0].id as number;
  }
  if (contact.phone) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .eq("phone", contact.phone)
      .limit(1);
    if (data && data.length > 0) return data[0].id as number;
  }
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`customer create: ${error?.message ?? "no row"}`);
  return data.id as number;
}
