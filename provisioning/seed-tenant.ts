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
 * (slug, business_name, features, etc.) are used by provision-customer.ts.
 *
 * The upsert logic lives in lib/seed-core.ts so it can be reused by the
 * `supabase_seed` provisioning step.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  ALLOWED_BEHAVIORS,
  seedAll,
  tenantClient,
  type SeedInputs,
  type StatusSeed,
  type LocationSeed,
} from "./lib/seed-core.ts";

interface Manifest {
  slug?: string;
  business_name?: string;
  initial_data?: SeedInputs;
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
      validateStatus(s, i);
      if (seenKeys.has(s.key)) fail(`duplicate status key "${s.key}" in manifest`);
      seenKeys.add(s.key);
    }
  }

  if (init.locations) {
    const seenNames = new Set<string>();
    for (const [i, l] of init.locations.entries()) {
      validateLocation(l, i);
      if (seenNames.has(l.name)) fail(`duplicate location name "${l.name}" in manifest`);
      seenNames.add(l.name);
    }
  }

  if (init.categories) {
    const seenNames = new Set<string>();
    for (const [i, name] of init.categories.entries()) {
      if (typeof name !== "string" || !name.trim()) {
        fail(`initial_data.categories[${i}] must be a non-empty string`);
      }
      if (seenNames.has(name)) fail(`duplicate category name "${name}" in manifest`);
      seenNames.add(name);
    }
  }

  return m;
}

function validateStatus(s: StatusSeed, i: number): void {
  if (!s.key || !s.name || !s.color || !s.behavior) {
    fail(
      `initial_data.statuses[${i}] is missing required fields (key, name, color, behavior)`
    );
  }
  if (!ALLOWED_BEHAVIORS.includes(s.behavior)) {
    fail(
      `initial_data.statuses[${i}].behavior is "${s.behavior}"; must be one of ${ALLOWED_BEHAVIORS.join(", ")}`
    );
  }
}

function validateLocation(l: LocationSeed, i: number): void {
  if (!l.name) {
    fail(`initial_data.locations[${i}] is missing required field name`);
  }
}

async function main(): Promise<void> {
  const { manifestPath, dryRun } = parseArgs();

  console.log(`reading manifest: ${manifestPath}`);
  const raw = readFileSync(manifestPath, "utf8");
  const manifest = validateManifest(parseYaml(raw));
  const init = manifest.initial_data!;

  console.log(
    `tenant: ${manifest.business_name ?? "(no business_name)"}` +
      (manifest.slug ? ` [${manifest.slug}]` : "")
  );

  if (dryRun) {
    console.log("DRY RUN — no rows will be written\n");
    for (const c of init.categories ?? []) console.log(`  + category: ${c}`);
    for (const s of init.statuses ?? []) {
      console.log(
        `  + status: ${s.key} (${s.name}) color=${s.color} behavior=${s.behavior}`
      );
    }
    for (const l of init.locations ?? []) {
      const coords =
        l.latitude != null && l.longitude != null
          ? `(${l.latitude}, ${l.longitude})`
          : "(no coords)";
      console.log(`  + location: ${l.name} ${coords}`);
    }
    console.log("\ndone.");
    return;
  }

  const url = process.env.TENANT_SUPABASE_URL;
  const key = process.env.TENANT_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    fail(
      "TENANT_SUPABASE_URL and TENANT_SUPABASE_SERVICE_KEY must be set (or use --dry-run)"
    );
  }

  const supabase = tenantClient(url, key);
  console.log("writing to Supabase\n");
  await seedAll(supabase, init);
  console.log("\ndone.");
}

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});
