import { createServerSupabaseClient } from "./supabase";
import type { SamsaraDeviceWithEquipment } from "./types";

export async function getSamsaraDevices(companyId: number): Promise<SamsaraDeviceWithEquipment[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("samsara_devices")
    .select(
      `
      id, gateway_serial, samsara_id, samsara_name, notes, equipment_id, is_active,
      last_seen_at, created_at, updated_at,
      equipment (
        id, gl_code, equipment_name,
        equipment_status ( status )
      )
    `
    )
    .eq("company_id", companyId)
    .order("samsara_name", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`getSamsaraDevices: ${error.message}`);

  return (data as any[]).map((row) => ({
    id: row.id,
    gateway_serial: row.gateway_serial,
    samsara_id: row.samsara_id,
    samsara_name: row.samsara_name,
    notes: row.notes,
    equipment_id: row.equipment_id,
    is_active: row.is_active,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    equipment: row.equipment
      ? {
          id: row.equipment.id,
          gl_code: row.equipment.gl_code,
          equipment_name: row.equipment.equipment_name,
          status: row.equipment.equipment_status?.[0]?.status ?? "",
        }
      : null,
  }));
}

export async function upsertSamsaraDevice(companyId: number, input: {
  samsara_id: string;
  samsara_name?: string | null;
  gateway_serial?: string;
  last_seen_at: string | null;
}): Promise<void> {
  const supabase = createServerSupabaseClient();

  const payload: Record<string, unknown> = {
    company_id: companyId,
    samsara_id: input.samsara_id,
    last_seen_at: input.last_seen_at,
    updated_at: new Date().toISOString(),
  };
  if (input.samsara_name !== undefined) {
    payload.samsara_name = input.samsara_name;
  }
  if (input.gateway_serial !== undefined) {
    payload.gateway_serial = input.gateway_serial;
  }

  const { error } = await supabase
    .from("samsara_devices")
    .upsert(payload, { onConflict: "company_id,samsara_id" });

  if (error) throw new Error(`upsertSamsaraDevice: ${error.message}`);
}

export async function updateSamsaraDevice(
  companyId: number,
  id: number,
  patch: {
    notes?: string | null;
    equipment_id?: number | null;
    is_active?: boolean;
    gateway_serial?: string | null;
    samsara_name?: string | null;
  }
): Promise<void> {
  const supabase = createServerSupabaseClient();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.equipment_id !== undefined) update.equipment_id = patch.equipment_id;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  if (patch.gateway_serial !== undefined) update.gateway_serial = patch.gateway_serial;
  if (patch.samsara_name !== undefined) update.samsara_name = patch.samsara_name;

  const { error } = await supabase
    .from("samsara_devices")
    .update(update)
    .eq("company_id", companyId)
    .eq("id", id);
  if (error) throw new Error(`updateSamsaraDevice: ${error.message}`);
}

export async function getExistingSamsaraNames(companyId: number): Promise<Record<string, string | null>> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("samsara_devices")
    .select("samsara_id, samsara_name")
    .eq("company_id", companyId);
  if (error) throw new Error(`getExistingSamsaraNames: ${error.message}`);
  const out: Record<string, string | null> = {};
  for (const row of (data ?? []) as { samsara_id: string; samsara_name: string | null }[]) {
    out[row.samsara_id] = row.samsara_name;
  }
  return out;
}

export async function getEquipmentOptions(companyId: number): Promise<
  { id: number; gl_code: string; equipment_name: string }[]
> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("equipment")
    .select("id, gl_code, equipment_name")
    .eq("company_id", companyId)
    .order("gl_code", { ascending: true });
  if (error) throw new Error(`getEquipmentOptions: ${error.message}`);
  return (data ?? []) as { id: number; gl_code: string; equipment_name: string }[];
}
