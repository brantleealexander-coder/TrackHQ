import { createSupabaseServiceClient } from "./supabase";

export interface CompanySummary {
  id: number;
  name: string;
  slug: string;
  brand_color: string | null;
  member_count: number;
  created_at: string;
}

export async function listCompanies(): Promise<CompanySummary[]> {
  const supabase = createSupabaseServiceClient();
  const [companiesRes, membershipsRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, slug, brand_color, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("memberships").select("company_id"),
  ]);

  const memberCounts = new Map<number, number>();
  for (const m of membershipsRes.data ?? []) {
    const id = m.company_id as number;
    memberCounts.set(id, (memberCounts.get(id) ?? 0) + 1);
  }

  return ((companiesRes.data ?? []) as Array<{
    id: number;
    name: string;
    slug: string;
    brand_color: string | null;
    created_at: string;
  }>).map((c) => ({
    ...c,
    member_count: memberCounts.get(c.id) ?? 0,
  }));
}

export type LeadStatus = "new" | "contacted" | "converted" | "declined";

export interface LeadRow {
  id: number;
  kind: "demo" | "contact";
  name: string;
  email: string;
  phone: string | null;
  business_name: string;
  rental_type: string | null;
  current_software: string | null;
  message: string | null;
  status: LeadStatus;
  created_at: string;
}

export async function listLeads(): Promise<LeadRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, kind, name, email, phone, business_name, rental_type, current_software, message, status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data as LeadRow[];
}
