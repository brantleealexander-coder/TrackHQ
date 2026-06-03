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

// Look up by email (case-insensitive), then phone. Returns the customer id
// when a match is found.
export async function findExistingCustomer(
  client: SupabaseClient,
  key: CustomerDedupeKey
): Promise<number | null> {
  if (key.email && key.email.trim().length > 0) {
    const { data } = await client
      .from("customers")
      .select("id")
      .ilike("email", key.email.trim())
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as number;
  }
  if (key.phone && key.phone.trim().length > 0) {
    const { data } = await client
      .from("customers")
      .select("id")
      .eq("phone", key.phone.trim())
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as number;
  }
  return null;
}

// Dedupe-aware insert: returns the existing customer id when one matches
// by email or phone; otherwise inserts and returns the new id.
export async function upsertCustomer(
  input: NewCustomerInput,
  client?: SupabaseClient
): Promise<{ id: number; created: boolean }> {
  const supabase = client ?? createServerSupabaseClient();

  const existingId = await findExistingCustomer(supabase, {
    email: input.email,
    phone: input.phone,
  });
  if (existingId) return { id: existingId, created: false };

  const { data, error } = await supabase
    .from("customers")
    .insert({
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

export async function createCustomer(input: NewCustomerInput): Promise<number> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
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
