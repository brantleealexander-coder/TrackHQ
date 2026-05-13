import { createServerSupabaseClient } from "./supabase";
import type { FleetRow, EquipmentWithStatus, Status, StatusBehavior } from "./types";

// Fetch all equipment with current status, category, and home location.
export async function getFleet(): Promise<FleetRow[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment")
    .select(
      `
      id, gl_code, serial_number, category_id, equipment_name, year,
      rate_daily, rate_weekly, rate_monthly, home_location_id, is_cross_charge,
      current_address, current_lat, current_lng,
      categories ( name ),
      locations ( name ),
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
    serial_number: row.serial_number ?? null,
    category_id: row.category_id,
    category_name: row.categories?.name ?? `Category ${row.category_id}`,
    equipment_name: row.equipment_name,
    year: row.year,
    rate_daily: row.rate_daily,
    rate_weekly: row.rate_weekly,
    rate_monthly: row.rate_monthly,
    home_location_id: row.home_location_id,
    home_location_name: row.locations?.name ?? null,
    is_cross_charge: row.is_cross_charge,
    status: row.equipment_status?.[0]?.status ?? "",
    customer_name: row.equipment_status?.[0]?.customer_name ?? null,
    job_po_notes: row.equipment_status?.[0]?.job_po_notes ?? null,
    rate_type: row.equipment_status?.[0]?.rate_type ?? null,
    rental_start: row.equipment_status?.[0]?.rental_start ?? null,
    rental_end: row.equipment_status?.[0]?.rental_end ?? null,
    status_updated_at: row.equipment_status?.[0]?.updated_at ?? null,
    current_address: row.current_address ?? null,
    current_lat: row.current_lat ?? null,
    current_lng: row.current_lng ?? null,
  }));
}

// All statuses defined for this tenant. Used to build color maps and
// behavior lookups in UI code.
export async function getStatuses(): Promise<Status[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("statuses")
    .select("key, name, color, behavior, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getStatuses: ${error.message}`);
  return (data ?? []) as Status[];
}

// Build a key→Status map so lookups by status key are O(1).
export function statusMapFromList(statuses: Status[]): Map<string, Status> {
  return new Map(statuses.map((s) => [s.key, s]));
}

// Return the behavior of a status key, or `undefined` if the key is not
// configured for this tenant.
export function behaviorOf(
  statusKey: string | null | undefined,
  byKey: Map<string, Status>
): StatusBehavior | undefined {
  if (!statusKey) return undefined;
  return byKey.get(statusKey)?.behavior;
}

// Status counts keyed by status key (caller can look up display name/behavior
// via getStatuses if needed).
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

// Active rentals = units whose current status has behavior 'rented'.
// We filter via Postgrest's joined-column syntax: !inner forces the join to
// participate in the WHERE clause.
export async function getActiveRentals() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment_status")
    .select(
      `
      equipment_id, rental_start, rental_end, rate_type, status,
      statuses!inner ( behavior ),
      equipment ( rate_daily, rate_weekly, rate_monthly, gl_code, equipment_name )
    `
    )
    .eq("statuses.behavior", "rented")
    .not("rental_start", "is", null);

  if (error) throw new Error(`getActiveRentals: ${error.message}`);
  return data ?? [];
}

// Fetch rental history for revenue calculations.
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

// Fetch a single equipment unit with category + home location + current status.
export async function getUnitDetail(id: number) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment")
    .select(
      `
      id, gl_code, serial_number, category_id, equipment_name, year,
      rate_daily, rate_weekly, rate_monthly, home_location_id, is_cross_charge,
      categories ( name ),
      locations ( name ),
      equipment_status ( status, customer_name, job_po_notes, rate_type, rental_start, rental_end, updated_at )
    `
    )
    .eq("id", id)
    .single();

  if (error) throw new Error(`getUnitDetail: ${error.message}`);
  return data;
}

// Fetch rental history for a single unit, newest first.
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

// Fetch maintenance logs for a single unit, newest first.
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

// All maintenance logs (for financials aggregation).
export async function getAllMaintenanceLogs() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("equipment_id, date, cost");

  if (error) throw new Error(`getAllMaintenanceLogs: ${error.message}`);
  return data ?? [];
}

// Equipment dropdown for admin pages — id, gl_code, name, plus category name.
export async function getEquipmentList() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("equipment")
    .select("id, gl_code, equipment_name, category_id, categories ( name )")
    .order("gl_code", { ascending: true });

  if (error) throw new Error(`getEquipmentList: ${error.message}`);
  return data ?? [];
}

// All categories, alphabetized. Replaces the hardcoded DIVISIONS array.
export async function getCategories() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(`getCategories: ${error.message}`);
  return (data ?? []) as { id: number; name: string }[];
}

// All locations, alphabetized.
export async function getLocations() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, address, latitude, longitude")
    .order("name", { ascending: true });
  if (error) throw new Error(`getLocations: ${error.message}`);
  return (data ?? []) as {
    id: number;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  }[];
}
