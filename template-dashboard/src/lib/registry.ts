import { type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, createSupabaseServiceClient } from "./supabase";

/**
 * Phase 7c+: TrackHQ is a single multi-tenant deployment, so "registry"
 * lookups now resolve to a row in the main `companies` table. Kept as a
 * separate module to keep the /book/<slug> POS code path tidy; downstream
 * code still calls getCustomer(slug) + createCustomerClient(customer).
 *
 * The old fork-per-customer registry (provisioning/registry-schema.sql)
 * stays in the repo for a future data-isolated tier; the runtime no
 * longer consults it.
 */

export interface CustomerCompany {
  company_id: number;
  slug: string;
  business_name: string;
  brand_color: string;
  logo_url: string | null;
  terminology_asset_plural: string;
  terminology_asset_singular: string;
}

export async function getCustomer(slug: string): Promise<CustomerCompany | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, slug, name, brand_color, logo_url")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return {
    company_id: data.id as number,
    slug: data.slug as string,
    business_name: data.name as string,
    brand_color: (data.brand_color as string) ?? "#F37535",
    logo_url: (data.logo_url as string | null) ?? null,
    terminology_asset_plural: "Assets",
    terminology_asset_singular: "Asset",
  };
}

// Service-role client for the POS path — same DB for every company now,
// but we use the service-role key so the public booking flow can write
// regardless of session state.
export function createCustomerClient(_customer: CustomerCompany): SupabaseClient {
  return createSupabaseServiceClient();
}
