import { createServerSupabaseClient } from "./supabase";

export interface AvailableAsset {
  id: number;
  gl_code: string;
  equipment_name: string;
  category_name: string;
  year: number | null;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
}

interface RawAsset {
  id: number;
  gl_code: string;
  equipment_name: string;
  year: number | null;
  category_id: number;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
  categories: { name: string } | null;
}

export async function getAvailableAssets(companyId: number): Promise<AvailableAsset[]> {
  const supabase = createServerSupabaseClient();

  const [{ data: statuses }, { data: equipment }] = await Promise.all([
    supabase.from("statuses").select("key, behavior"),
    supabase
      .from("equipment")
      .select(`
        id, gl_code, equipment_name, year, category_id,
        rate_daily, rate_weekly, rate_monthly,
        categories ( name ),
        equipment_status ( status )
      `)
      .eq("company_id", companyId)
      .order("equipment_name"),
  ]);

  const availableKeys = new Set(
    (statuses ?? [])
      .filter((s: { behavior: string }) => s.behavior === "available")
      .map((s: { key: string }) => s.key)
  );

  type WithStatus = RawAsset & { equipment_status: { status: string }[] | null };
  const rows = (equipment ?? []) as unknown as WithStatus[];

  return rows
    .filter((r) => {
      const statusKey = r.equipment_status?.[0]?.status;
      if (!statusKey) return true;
      return availableKeys.has(statusKey);
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
