import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Row in the central registry's `customers` table. Each row is one
// provisioned customer fork — fork_supabase_* fields let the master
// deployment (trackhq.com) query the customer's Supabase server-side
// to render /book/<slug> with that customer's branding + catalog.
export interface CustomerFork {
  slug: string;
  business_name: string;
  brand_color: string;
  logo_url: string | null;
  fork_supabase_url: string;
  fork_supabase_service_role_key: string;
  vapi_assistant_id: string | null;
  terminology_asset_plural: string;
  terminology_asset_singular: string;
  active: boolean;
}

function getRegistryClient(): SupabaseClient | null {
  const url = process.env.REGISTRY_SUPABASE_URL;
  const key = process.env.REGISTRY_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// When no registry is configured, build a synthetic CustomerFork from
// the local dev's existing Supabase env. /book/<anything> resolves to the
// same dev project — useful for local UI work before a registry exists.
function devFallback(slug: string): CustomerFork | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return {
    slug,
    business_name: process.env.NEXT_PUBLIC_DEV_CUSTOMER_NAME ?? "Crossmar (dev)",
    brand_color: process.env.NEXT_PUBLIC_DEV_CUSTOMER_BRAND ?? "#f97316",
    logo_url: null,
    fork_supabase_url: url,
    fork_supabase_service_role_key: key,
    vapi_assistant_id: null,
    terminology_asset_plural: "Fleet",
    terminology_asset_singular: "Unit",
    active: true,
  };
}

export async function getCustomer(slug: string): Promise<CustomerFork | null> {
  const reg = getRegistryClient();
  if (!reg) return devFallback(slug);

  const { data, error } = await reg
    .from("customers")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as CustomerFork;
}

// Service-role client into a customer's fork. Use this for both reads
// (catalog) and writes (booking request inserts) from /book/<slug>.
export function createCustomerClient(customer: CustomerFork): SupabaseClient {
  return createClient(
    customer.fork_supabase_url,
    customer.fork_supabase_service_role_key,
    { auth: { persistSession: false } }
  );
}
