import { createServerSupabaseClient } from "./supabase";
import type { FleetRow, EquipmentWithStatus } from "./types";

// Fetch all equipment with current status and division name
export async function getFleet(): Promise<FleetRow[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment")
    .select(
      `
      id, gl_code, serial_number, division_id, equipment_name, year,
      rate_daily, rate_weekly, rate_monthly, home_yard, is_cross_charge,
      current_address, current_lat, current_lng,
      divisions ( name ),
      equipment_status (
        status, customer_name, job_po_notes,
        rate_type, rental_start, rental_end, updated_at
      )
    `
    )
    .order("gl_code", { ascending: true });

  if (error) throw new Error(`getFleet: ${error.message}`);

  return (data as unknown as EquipmentWithStatus[]).map((row) => ({
    id: row.id,
    gl_code: row.gl_code,
    serial_number: (row as any).serial_number ?? null,
    division_id: row.division_id,
    division_name: row.divisions?.name ?? `Division ${row.division_id}`,
    equipment_name: row.equipment_name,
    year: row.year,
    rate_daily: row.rate_daily,
    rate_weekly: row.rate_weekly,
    rate_monthly: row.rate_monthly,
    home_yard: row.home_yard,
    is_cross_charge: row.is_cross_charge,
    status: row.equipment_status?.[0]?.status ?? "AVAILABLE",
    customer_name: row.equipment_status?.[0]?.customer_name ?? null,
    job_po_notes: row.equipment_status?.[0]?.job_po_notes ?? null,
    rate_type: row.equipment_status?.[0]?.rate_type ?? null,
    rental_start: row.equipment_status?.[0]?.rental_start ?? null,
    rental_end: row.equipment_status?.[0]?.rental_end ?? null,
    status_updated_at: row.equipment_status?.[0]?.updated_at ?? null,
    current_address: (row as any).current_address ?? null,
    current_lat: (row as any).current_lat ?? null,
    current_lng: (row as any).current_lng ?? null,
  }));
}

// Fetch status counts for utilization calculation
export async function getStatusCounts(): Promise<Record<string, number>> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment_status")
    .select("status");

  if (error) throw new Error(`getStatusCounts: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

// Fetch rental history for revenue calculations
export async function getRentalHistory() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("rental_history")
    .select(
      "equipment_id, revenue_amount, rental_start, rental_end, rate_type, status_after"
    )
    .not("revenue_amount", "is", null);

  if (error) throw new Error(`getRentalHistory: ${error.message}`);
  return data ?? [];
}

// Fetch active ON RENT units for projected revenue
export async function getActiveRentals() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment_status")
    .select(
      `
      equipment_id, rental_start, rental_end, rate_type,
      equipment ( rate_daily, rate_weekly, rate_monthly, gl_code, equipment_name )
    `
    )
    .eq("status", "ON RENT")
    .not("rental_start", "is", null);

  if (error) throw new Error(`getActiveRentals: ${error.message}`);
  return data ?? [];
}

// Fetch a single equipment unit with division + current status (for unit detail page)
export async function getUnitDetail(id: number) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment")
    .select(
      `
      id, gl_code, serial_number, division_id, equipment_name, year,
      rate_daily, rate_weekly, rate_monthly, home_yard, is_cross_charge,
      divisions ( name ),
      equipment_status ( status, customer_name, job_po_notes, rate_type, rental_start, rental_end, updated_at )
    `
    )
    .eq("id", id)
    .single();

  if (error) throw new Error(`getUnitDetail: ${error.message}`);
  return data;
}

// Fetch rental history for a single unit, newest first
export async function getUnitRentalHistory(equipmentId: number) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("rental_history")
    .select(
      "id, status_before, status_after, customer_name, job_po_notes, rate_type, rental_start, rental_end, revenue_amount, recorded_at"
    )
    .eq("equipment_id", equipmentId)
    .order("recorded_at", { ascending: false });

  if (error) throw new Error(`getUnitRentalHistory: ${error.message}`);
  return data ?? [];
}

// Fetch maintenance logs for a single unit, newest first
export async function getUnitMaintenanceLogs(equipmentId: number) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("id, equipment_id, date, cost, description, vendor, category, invoice_number, created_at, created_by")
    .eq("equipment_id", equipmentId)
    .order("date", { ascending: false });

  if (error) throw new Error(`getUnitMaintenanceLogs: ${error.message}`);
  return data ?? [];
}

// Fetch all maintenance logs (for financials aggregation)
export async function getAllMaintenanceLogs() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("equipment_id, date, cost");

  if (error) throw new Error(`getAllMaintenanceLogs: ${error.message}`);
  return data ?? [];
}

// Fetch equipment list for admin dropdown (id, gl_code, name, division only)
export async function getEquipmentList() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment")
    .select("id, gl_code, equipment_name, division_id, divisions ( name )")
    .order("gl_code", { ascending: true });

  if (error) throw new Error(`getEquipmentList: ${error.message}`);
  return data ?? [];
}
