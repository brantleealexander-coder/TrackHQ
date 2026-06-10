import { createServerSupabaseClient } from "./supabase";

export type BookingRequestStatus = "pending" | "confirmed" | "rejected";
export type BookingRequestSource = "web" | "voice";

export interface PendingBookingRequestRow {
  id: number;
  customer_id: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  equipment_id: number;
  equipment_name: string;
  gl_code: string;
  rental_start: string;
  rental_end: string;
  rate_type: string | null;
  notes: string | null;
  source: BookingRequestSource;
  created_at: string;
}

interface RawBookingRequest {
  id: number;
  customer_id: number | null;
  renter_name: string | null;
  renter_email: string | null;
  renter_phone: string | null;
  equipment_id: number;
  rental_start: string;
  rental_end: string;
  rate_type: string | null;
  notes: string | null;
  source: BookingRequestSource;
  created_at: string;
  equipment: { equipment_name: string | null; gl_code: string | null } | null;
  customers: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

function mapRow(r: RawBookingRequest): PendingBookingRequestRow {
  return {
    id: r.id,
    customer_id: r.customer_id,
    customer_name: r.customers?.name ?? r.renter_name ?? "Caller",
    customer_email: r.customers?.email ?? r.renter_email,
    customer_phone: r.customers?.phone ?? r.renter_phone,
    equipment_id: r.equipment_id,
    equipment_name: r.equipment?.equipment_name ?? "Asset",
    gl_code: r.equipment?.gl_code ?? "",
    rental_start: r.rental_start,
    rental_end: r.rental_end,
    rate_type: r.rate_type,
    notes: r.notes,
    source: r.source,
    created_at: r.created_at,
  };
}

export async function listPendingBookingRequests(
  companyId: number
): Promise<PendingBookingRequestRow[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("booking_requests")
    .select(
      `
      id, customer_id, renter_name, renter_email, renter_phone,
      equipment_id, rental_start, rental_end, rate_type, notes,
      source, created_at,
      equipment ( equipment_name, gl_code ),
      customers ( name, email, phone )
    `
    )
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return (data as unknown as RawBookingRequest[]).map(mapRow);
}

export async function countPendingBookingRequests(
  companyId: number
): Promise<number> {
  const supabase = createServerSupabaseClient();
  const { count, error } = await supabase
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

export async function getPendingBookingRequest(
  companyId: number,
  id: number
): Promise<PendingBookingRequestRow | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("booking_requests")
    .select(
      `
      id, customer_id, renter_name, renter_email, renter_phone,
      equipment_id, rental_start, rental_end, rate_type, notes,
      source, created_at,
      equipment ( equipment_name, gl_code ),
      customers ( name, email, phone )
    `
    )
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as unknown as RawBookingRequest);
}
