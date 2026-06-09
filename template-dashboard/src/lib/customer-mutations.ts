import { createServerSupabaseClient } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface NewCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
}

export interface CustomerDedupeKey {
  email?: string | null;
  phone?: string | null;
}

export async function findExistingCustomer(
  client: SupabaseClient,
  companyId: number,
  key: CustomerDedupeKey
): Promise<number | null> {
  if (key.email && key.email.trim().length > 0) {
    const { data } = await client
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .ilike("email", key.email.trim())
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as number;
  }
  if (key.phone && key.phone.trim().length > 0) {
    const { data } = await client
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .eq("phone", key.phone.trim())
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as number;
  }
  return null;
}

export async function upsertCustomer(
  companyId: number,
  input: NewCustomerInput,
  client?: SupabaseClient
): Promise<{ id: number; created: boolean }> {
  const supabase = client ?? createServerSupabaseClient();

  const existingId = await findExistingCustomer(supabase, companyId, {
    email: input.email,
    phone: input.phone,
  });
  if (existingId) return { id: existingId, created: false };

  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      address: input.address ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`upsertCustomer: ${error?.message ?? "no row"}`);
  return { id: data.id as number, created: true };
}

export async function createCustomer(companyId: number, input: NewCustomerInput): Promise<number> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      address: input.address ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createCustomer: ${error?.message ?? "no row"}`);
  return data.id as number;
}
