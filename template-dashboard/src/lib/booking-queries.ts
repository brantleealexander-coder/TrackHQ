import type { SupabaseClient } from "@supabase/supabase-js";

// Catalog row for /book/<slug>. Public-facing — no internal-only fields.
export interface CatalogUnit {
  id: number;
  gl_code: string;
  equipment_name: string;
  year: number | null;
  category_name: string;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
}

interface RawEquipmentRow {
  id: number;
  gl_code: string;
  equipment_name: string;
  year: number | null;
  category_id: number;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
  categories: { name: string } | null;
  equipment_status: { status: string }[] | null;
}

// Returns units whose current status behavior is 'available'.
export async function getAvailableCatalog(
  client: SupabaseClient,
  companyId: number
): Promise<CatalogUnit[]> {
  const [equipmentRes, statusesRes] = await Promise.all([
    client
      .from("equipment")
      .select(`
        id, gl_code, equipment_name, year, category_id,
        rate_daily, rate_weekly, rate_monthly,
        categories ( name ),
        equipment_status ( status )
      `)
      .eq("company_id", companyId)
      .order("equipment_name", { ascending: true }),
    client.from("statuses").select("key, behavior"),
  ]);

  if (equipmentRes.error) {
    throw new Error(`getAvailableCatalog: ${equipmentRes.error.message}`);
  }
  if (statusesRes.error) {
    throw new Error(`getAvailableCatalog statuses: ${statusesRes.error.message}`);
  }

  const behaviorByKey = new Map<string, string>();
  for (const s of (statusesRes.data ?? []) as { key: string; behavior: string }[]) {
    behaviorByKey.set(s.key, s.behavior);
  }

  const rows = (equipmentRes.data ?? []) as unknown as RawEquipmentRow[];
  return rows
    .filter((r) => {
      const statusKey = r.equipment_status?.[0]?.status;
      if (!statusKey) return false;
      return behaviorByKey.get(statusKey) === "available";
    })
    .map((r) => ({
      id: r.id,
      gl_code: r.gl_code,
      equipment_name: r.equipment_name,
      year: r.year,
      category_name: r.categories?.name ?? `Category ${r.category_id}`,
      rate_daily: r.rate_daily,
      rate_weekly: r.rate_weekly,
      rate_monthly: r.rate_monthly,
    }));
}

export async function getCatalogUnit(
  client: SupabaseClient,
  companyId: number,
  id: number
): Promise<CatalogUnit | null> {
  const { data, error } = await client
    .from("equipment")
    .select(`
      id, gl_code, equipment_name, year, category_id,
      rate_daily, rate_weekly, rate_monthly,
      categories ( name )
    `)
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as Omit<RawEquipmentRow, "equipment_status">;
  return {
    id: row.id,
    gl_code: row.gl_code,
    equipment_name: row.equipment_name,
    year: row.year,
    category_name: row.categories?.name ?? `Category ${row.category_id}`,
    rate_daily: row.rate_daily,
    rate_weekly: row.rate_weekly,
    rate_monthly: row.rate_monthly,
  };
}

export interface BookingRequestInput {
  equipment_id: number;
  renter_name: string;
  renter_email: string;
  renter_phone: string | null;
  rental_start: string;
  rental_end: string;
  rate_type: "daily" | "weekly" | "monthly" | null;
  notes: string | null;
  source?: "web" | "voice";
  customer_id?: number | null;
}

export async function insertBookingRequest(
  client: SupabaseClient,
  companyId: number,
  input: BookingRequestInput
): Promise<{ id: number }> {
  const { data, error } = await client
    .from("booking_requests")
    .insert({
      company_id: companyId,
      equipment_id: input.equipment_id,
      renter_name: input.renter_name,
      renter_email: input.renter_email,
      renter_phone: input.renter_phone,
      rental_start: input.rental_start,
      rental_end: input.rental_end,
      rate_type: input.rate_type,
      notes: input.notes,
      source: input.source ?? "web",
      customer_id: input.customer_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertBookingRequest: ${error.message}`);
  return { id: data.id };
}
