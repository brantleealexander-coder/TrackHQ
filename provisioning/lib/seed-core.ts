/**
 * Core taxonomy-seeding logic.
 *
 * Shared between:
 *   - seed-tenant.ts (operator CLI for one-off re-seeding)
 *   - lib/steps/supabase_seed.ts (Phase 4 provisioning orchestrator)
 *
 * All operations are idempotent upserts. Validation happens at the
 * manifest layer (lib/manifest.ts or seed-tenant.ts's argparse).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ALLOWED_BEHAVIORS = [
  "rented",
  "available",
  "out_of_service",
  "reserved",
  "pending_return",
] as const;
export type Behavior = (typeof ALLOWED_BEHAVIORS)[number];

export interface StatusSeed {
  key: string;
  name: string;
  color: string;
  behavior: Behavior;
  sort_order?: number;
}

export interface LocationSeed {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SeedInputs {
  categories?: string[];
  statuses?: StatusSeed[];
  locations?: LocationSeed[];
}

export interface SeedLogger {
  info(msg: string): void;
}

const defaultLogger: SeedLogger = {
  info: (msg: string) => console.log(msg),
};

export function tenantClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function seedCategories(
  supabase: SupabaseClient,
  names: string[],
  logger: SeedLogger = defaultLogger
): Promise<void> {
  if (names.length === 0) {
    logger.info("  (no categories to seed)");
    return;
  }
  const rows = names.map((name) => ({ name }));
  const { error } = await supabase
    .from("categories")
    .upsert(rows, { onConflict: "name" });
  if (error) throw new Error(`categories upsert failed: ${error.message}`);
  logger.info(`  upserted ${rows.length} category rows`);
}

export async function seedStatuses(
  supabase: SupabaseClient,
  statuses: StatusSeed[],
  logger: SeedLogger = defaultLogger
): Promise<void> {
  if (statuses.length === 0) {
    logger.info("  (no statuses to seed)");
    return;
  }
  const rows = statuses.map((s, i) => ({
    key: s.key,
    name: s.name,
    color: s.color,
    behavior: s.behavior,
    sort_order: s.sort_order ?? (i + 1) * 10,
  }));
  const { error } = await supabase
    .from("statuses")
    .upsert(rows, { onConflict: "key" });
  if (error) throw new Error(`statuses upsert failed: ${error.message}`);
  logger.info(`  upserted ${rows.length} status rows`);
}

export async function seedLocations(
  supabase: SupabaseClient,
  locations: LocationSeed[],
  logger: SeedLogger = defaultLogger
): Promise<void> {
  if (locations.length === 0) {
    logger.info("  (no locations to seed)");
    return;
  }
  const rows = locations.map((l) => ({
    name: l.name,
    address: l.address ?? null,
    latitude: l.latitude ?? null,
    longitude: l.longitude ?? null,
  }));
  const { error } = await supabase
    .from("locations")
    .upsert(rows, { onConflict: "name" });
  if (error) throw new Error(`locations upsert failed: ${error.message}`);
  logger.info(`  upserted ${rows.length} location rows`);
}

/** Run all three seeds in order. Surfaces the first error. */
export async function seedAll(
  supabase: SupabaseClient,
  inputs: SeedInputs,
  logger: SeedLogger = defaultLogger
): Promise<void> {
  logger.info("categories:");
  await seedCategories(supabase, inputs.categories ?? [], logger);
  logger.info("statuses:");
  await seedStatuses(supabase, inputs.statuses ?? [], logger);
  logger.info("locations:");
  await seedLocations(supabase, inputs.locations ?? [], logger);
}
