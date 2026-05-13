/**
 * seed-tenant.ts — Seed a TrackHQ tenant's reference tables from a YAML manifest.
 *
 * Idempotent: re-running with the same manifest is safe (upsert by name/key).
 *
 * Usage:
 *   TENANT_SUPABASE_URL=... TENANT_SUPABASE_SERVICE_KEY=... \
 *     npx tsx seed-tenant.ts ../examples/crossmar/customer-manifest.yaml
 *
 *   Add --dry-run to print what would be inserted without contacting Supabase.
 *
 * The CLI only reads the `initial_data` block from the manifest. Other fields
 * (slug, business_name, features, etc.) are used by the full
 * provision-customer.ts CLI in Phase 4.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_BEHAVIORS = [
  "rented",
  "available",
  "out_of_service",
  "reserved",
  "pending_return",
] as const;
type Behavior = (typeof ALLOWED_BEHAVIORS)[number];

interface StatusManifest {
  key: string;
  name: string;
  color: string;
  behavior: Behavior;
  sort_order?: number;
}

interface LocationManifest {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface InitialData {
  categories?: string[];
  statuses?: StatusManifest[];
  locations?: LocationManifest[];
}

interface Manifest {
  slug?: string;
  business_name?: string;
  initial_data?: InitialData;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseArgs(): { manifestPath: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length !== 1) {
    fail(
      "usage: tsx seed-tenant.ts <path/to/customer-manifest.yaml> [--dry-run]"
    );
  }
  return { manifestPath: resolve(positional[0]), dryRun };
}

function validateManifest(raw: unknown): Manifest {
  if (typeof raw !== "object" || raw === null) {
    fail("manifest must be a YAML object");
  }
  const m = raw as Manifest;
  const init = m.initial_data;
  if (!init) {
    fail("manifest is missing initial_data block");
  }

  if (init.statuses) {
    const seenKeys = new Set<string>();
    for (const [i, s] of init.statuses.entries()) {
      if (!s.key || !s.name || !s.color || !s.behavior) {
        fail(`initial_data.statuses[${i}] is missing required fields (key, name, color, behavior)`);
      }
      if (!ALLOWED_BEHAVIORS.includes(s.behavior)) {
        fail(
          `initial_data.statuses[${i}].behavior is "${s.behavior}"; must be one of ${ALLOWED_BEHAVIORS.join(", ")}`
        );
      }
      if (seenKeys.has(s.key)) {
        fail(`duplicate status key "${s.key}" in manifest`);
      }
      seenKeys.add(s.key);
    }
  }

  if (init.locations) {
    const seenNames = new Set<string>();
    for (const [i, l] of init.locations.entries()) {
      if (!l.name) {
        fail(`initial_data.locations[${i}] is missing required field name`);
      }
      if (seenNames.has(l.name)) {
        fail(`duplicate location name "${l.name}" in manifest`);
      }
      seenNames.add(l.name);
    }
  }

  if (init.categories) {
    const seenNames = new Set<string>();
    for (const [i, name] of init.categories.entries()) {
      if (typeof name !== "string" || !name.trim()) {
        fail(`initial_data.categories[${i}] must be a non-empty string`);
      }
      if (seenNames.has(name)) {
        fail(`duplicate category name "${name}" in manifest`);
      }
      seenNames.add(name);
    }
  }

  return m;
}

async function seedCategories(
  supabase: SupabaseClient,
  names: string[],
  dryRun: boolean
): Promise<void> {
  if (names.length === 0) {
    console.log("  (no categories to seed)");
    return;
  }
  const rows = names.map((name) => ({ name }));
  if (dryRun) {
    for (const r of rows) console.log(`  + category: ${r.name}`);
    return;
  }
  const { error } = await supabase
    .from("categories")
    .upsert(rows, { onConflict: "name" });
  if (error) fail(`categories upsert failed: ${error.message}`);
  console.log(`  upserted ${rows.length} category rows`);
}

async function seedStatuses(
  supabase: SupabaseClient,
  statuses: StatusManifest[],
  dryRun: boolean
): Promise<void> {
  if (statuses.length === 0) {
    console.log("  (no statuses to seed)");
    return;
  }
  const rows = statuses.map((s, i) => ({
    key: s.key,
    name: s.name,
    color: s.color,
    behavior: s.behavior,
    sort_order: s.sort_order ?? (i + 1) * 10,
  }));
  if (dryRun) {
    for (const r of rows) {
      console.log(
        `  + status: ${r.key} (${r.name}) color=${r.color} behavior=${r.behavior} sort=${r.sort_order}`
      );
    }
    return;
  }
  const { error } = await supabase
    .from("statuses")
    .upsert(rows, { onConflict: "key" });
  if (error) fail(`statuses upsert failed: ${error.message}`);
  console.log(`  upserted ${rows.length} status rows`);
}

async function seedLocations(
  supabase: SupabaseClient,
  locations: LocationManifest[],
  dryRun: boolean
): Promise<void> {
  if (locations.length === 0) {
    console.log("  (no locations to seed)");
    return;
  }
  const rows = locations.map((l) => ({
    name: l.name,
    address: l.address ?? null,
    latitude: l.latitude ?? null,
    longitude: l.longitude ?? null,
  }));
  if (dryRun) {
    for (const r of rows) {
      const coords =
        r.latitude != null && r.longitude != null
          ? `(${r.latitude}, ${r.longitude})`
          : "(no coords)";
      console.log(`  + location: ${r.name} ${coords}`);
    }
    return;
  }
  const { error } = await supabase
    .from("locations")
    .upsert(rows, { onConflict: "name" });
  if (error) fail(`locations upsert failed: ${error.message}`);
  console.log(`  upserted ${rows.length} location rows`);
}

async function main() {
  const { manifestPath, dryRun } = parseArgs();

  console.log(`reading manifest: ${manifestPath}`);
  const raw = readFileSync(manifestPath, "utf8");
  const manifest = validateManifest(parseYaml(raw));
  const init = manifest.initial_data!;

  console.log(
    `tenant: ${manifest.business_name ?? "(no business_name)"}` +
      (manifest.slug ? ` [${manifest.slug}]` : "")
  );
  console.log(dryRun ? "DRY RUN — no rows will be written" : "writing to Supabase");

  let supabase: SupabaseClient | null = null;
  if (!dryRun) {
    const url = process.env.TENANT_SUPABASE_URL;
    const key = process.env.TENANT_SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      fail(
        "TENANT_SUPABASE_URL and TENANT_SUPABASE_SERVICE_KEY must be set (or use --dry-run)"
      );
    }
    supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  console.log("\ncategories:");
  await seedCategories(supabase!, init.categories ?? [], dryRun);

  console.log("\nstatuses:");
  await seedStatuses(supabase!, init.statuses ?? [], dryRun);

  console.log("\nlocations:");
  await seedLocations(supabase!, init.locations ?? [], dryRun);

  console.log("\ndone.");
}

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});
