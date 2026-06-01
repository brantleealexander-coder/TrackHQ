/**
 * dev-bootstrap.ts — seed a Supabase project for local dashboard development.
 *
 * Run this AFTER you've:
 *   1. Created a free-tier project at supabase.com
 *   2. Pasted template-dashboard/supabase_schema.sql into the SQL Editor
 *      and clicked Run (one-time, until automated by Phase 4 provisioning)
 *
 * Usage:
 *   $env:SUPABASE_URL="https://yourref.supabase.co"
 *   $env:SUPABASE_SERVICE_KEY="eyJ..."
 *   cd provisioning
 *   npx tsx dev-bootstrap.ts
 *
 *   Defaults to examples/crossmar/customer-manifest.yaml for the taxonomy.
 *   Pass `--manifest=<path>` to use a different one.
 *
 * What it does:
 *   - Seeds categories / statuses / locations from the manifest's initial_data
 *   - Inserts 10 fake equipment rows + statuses across DFW lat/lng so the
 *     fleet table + map have something visible
 *   - Prints the .env.local block for template-dashboard/ so you can paste it
 *
 * Idempotent: re-running with the same Supabase URL upserts/overwrites
 * the same dev rows (gl_codes are stable like DEV-001, DEV-002, ...).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse as parseYaml } from "yaml";
import { seedAll } from "./lib/seed-core.ts";

/** Load provisioning/.env into process.env (does NOT overwrite already-set vars). */
function loadDotenv(): void {
  const path = resolve(__dirname, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) && value.length > 0) {
      process.env[key] = value;
    }
  }
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseArgs(): { manifestPath: string } {
  const args = process.argv.slice(2);
  let manifestPath = resolve(
    __dirname,
    "..",
    "examples",
    "crossmar",
    "customer-manifest.yaml"
  );
  for (const a of args) {
    if (a.startsWith("--manifest=")) {
      manifestPath = resolve(a.slice("--manifest=".length));
    }
  }
  return { manifestPath };
}

const __dirname = new URL(".", import.meta.url).pathname.replace(/^\//, "");

interface FakeUnit {
  gl_code: string;
  serial_number: string;
  category_name: string;
  equipment_name: string;
  year: number;
  rate_daily: number;
  rate_weekly: number;
  rate_monthly: number;
  home_location_name?: string;
  current_lat?: number;
  current_lng?: number;
  current_address?: string;
  status_key: string;
  customer_name?: string;
  rental_end?: string;
}

// Lat/lng cluster around DFW / North Texas — overlaps Crossmar's actual
// territory so the map visualization looks reasonable.
const FAKE_UNITS: FakeUnit[] = [
  {
    gl_code: "DEV-001",
    serial_number: "CAT3140",
    category_name: "Excavators",
    equipment_name: "CAT 314 Excavator",
    year: 2021,
    rate_daily: 450,
    rate_weekly: 1800,
    rate_monthly: 5400,
    current_lat: 32.7767,
    current_lng: -96.7970,
    current_address: "Construction site, Dallas, TX",
    status_key: "on_rent",
    customer_name: "BlueLine Construction",
    rental_end: "2026-06-30",
  },
  {
    gl_code: "DEV-002",
    serial_number: "JD310SL",
    category_name: "Backhoe Loader",
    equipment_name: "John Deere 310SL",
    year: 2020,
    rate_daily: 280,
    rate_weekly: 1120,
    rate_monthly: 3360,
    home_location_name: "Texas (Tioga)",
    status_key: "available",
  },
  {
    gl_code: "DEV-003",
    serial_number: "CAT299D3",
    category_name: "Skid Steer",
    equipment_name: "CAT 299D3 Skid Steer",
    year: 2022,
    rate_daily: 350,
    rate_weekly: 1400,
    rate_monthly: 4200,
    home_location_name: "Arkansas",
    status_key: "in_service",
  },
  {
    gl_code: "DEV-004",
    serial_number: "BOMAG120",
    category_name: "Compactor",
    equipment_name: "Bomag BW120 Roller",
    year: 2019,
    rate_daily: 195,
    rate_weekly: 780,
    rate_monthly: 2340,
    current_lat: 33.0198,
    current_lng: -96.6989,
    current_address: "Plano TX job site",
    status_key: "on_rent",
    customer_name: "Plano Earthworks",
    rental_end: "2026-05-25",
  },
  {
    gl_code: "DEV-005",
    serial_number: "GENIES65",
    category_name: "Lifts",
    equipment_name: "Genie S-65 Boom Lift",
    year: 2021,
    rate_daily: 240,
    rate_weekly: 960,
    rate_monthly: 2880,
    home_location_name: "Midland, TX",
    status_key: "reserved",
    customer_name: "Quanta Energy",
  },
  {
    gl_code: "DEV-006",
    serial_number: "PETERBILT579",
    category_name: "Water Trucks",
    equipment_name: "Peterbilt 579 Water Truck",
    year: 2018,
    rate_daily: 320,
    rate_weekly: 1280,
    rate_monthly: 3840,
    home_location_name: "Texas (Tioga)",
    status_key: "available",
  },
  {
    gl_code: "DEV-007",
    serial_number: "CAT745",
    category_name: "Articulating Trucks",
    equipment_name: "CAT 745 Articulating Truck",
    year: 2020,
    rate_daily: 520,
    rate_weekly: 2080,
    rate_monthly: 6240,
    current_lat: 32.025369,
    current_lng: -101.908339,
    current_address: "Midland Basin pad #7",
    status_key: "on_rent",
    customer_name: "Permian Drilling Co.",
    rental_end: "2026-08-15",
  },
  {
    gl_code: "DEV-008",
    serial_number: "KOMATSU155",
    category_name: "Dozers",
    equipment_name: "Komatsu D155 Dozer",
    year: 2017,
    rate_daily: 480,
    rate_weekly: 1920,
    rate_monthly: 5760,
    home_location_name: "Arkansas",
    status_key: "down",
  },
  {
    gl_code: "DEV-009",
    serial_number: "JLG1255",
    category_name: "Telehandler",
    equipment_name: "JLG 1255 Telehandler",
    year: 2022,
    rate_daily: 380,
    rate_weekly: 1520,
    rate_monthly: 4560,
    home_location_name: "Texas (Tioga)",
    status_key: "off_rent_pending",
    customer_name: "Frisco Builders LLC",
  },
  {
    gl_code: "DEV-010",
    serial_number: "FREUHAUF40",
    category_name: "Trailers",
    equipment_name: "Fruehauf 40' Lowboy Trailer",
    year: 2016,
    rate_daily: 150,
    rate_weekly: 600,
    rate_monthly: 1800,
    home_location_name: "Texas (Tioga)",
    status_key: "available",
  },
];

interface ManifestShape {
  business_name?: string;
  brand_color?: string;
  initial_data?: Parameters<typeof seedAll>[1];
}

async function verifySchemaApplied(supabase: SupabaseClient): Promise<void> {
  // Probe the categories table. If schema is missing, supabase-js returns
  // a PGRST error mentioning "relation does not exist".
  const { error } = await supabase.from("categories").select("id").limit(1);
  if (error) {
    if (error.message.includes("does not exist") || error.code === "42P01") {
      fail(
        `Schema not applied. Open Supabase → SQL Editor → New query, paste\n` +
          `the contents of template-dashboard/supabase_schema.sql, click Run.\n` +
          `Then re-run this script.`
      );
    }
    fail(`schema check failed: ${error.message}`);
  }
}

async function insertFakeEquipment(
  supabase: SupabaseClient
): Promise<void> {
  // Look up category / location / status keys
  const { data: cats, error: catsErr } = await supabase
    .from("categories")
    .select("id, name");
  if (catsErr) fail(`reading categories: ${catsErr.message}`);
  const catByName = new Map((cats ?? []).map((c) => [c.name, c.id as number]));

  const { data: locs, error: locsErr } = await supabase
    .from("locations")
    .select("id, name");
  if (locsErr) fail(`reading locations: ${locsErr.message}`);
  const locByName = new Map((locs ?? []).map((l) => [l.name, l.id as number]));

  console.log(`\ninserting ${FAKE_UNITS.length} fake equipment rows...`);

  // Filter out units whose category isn't seeded — manifest taxonomy varies.
  const present = FAKE_UNITS.filter((u) => {
    if (!catByName.has(u.category_name)) {
      console.log(`  skipping ${u.gl_code} (category "${u.category_name}" not in manifest)`);
      return false;
    }
    return true;
  });

  const equipmentRows = present.map((u) => ({
    gl_code: u.gl_code,
    serial_number: u.serial_number,
    category_id: catByName.get(u.category_name)!,
    equipment_name: u.equipment_name,
    year: u.year,
    rate_daily: u.rate_daily,
    rate_weekly: u.rate_weekly,
    rate_monthly: u.rate_monthly,
    home_location_id: u.home_location_name
      ? (locByName.get(u.home_location_name) ?? null)
      : null,
    current_address: u.current_address ?? null,
    current_lat: u.current_lat ?? null,
    current_lng: u.current_lng ?? null,
  }));

  const { data: inserted, error: equipErr } = await supabase
    .from("equipment")
    .upsert(equipmentRows, { onConflict: "gl_code" })
    .select("id, gl_code");
  if (equipErr) fail(`equipment upsert: ${equipErr.message}`);
  console.log(`  upserted ${inserted?.length ?? 0} equipment rows`);

  const idByGl = new Map((inserted ?? []).map((r) => [r.gl_code, r.id as number]));
  const statusRows = present.map((u) => ({
    equipment_id: idByGl.get(u.gl_code)!,
    status: u.status_key,
    customer_name: u.customer_name ?? null,
    rental_end: u.rental_end ?? null,
    rate_type: u.rental_end ? "monthly" : null,
  }));

  // equipment_status has a UNIQUE constraint on equipment_id, so this is also
  // an idempotent upsert.
  const { error: statErr } = await supabase
    .from("equipment_status")
    .upsert(statusRows, { onConflict: "equipment_id" });
  if (statErr) fail(`equipment_status upsert: ${statErr.message}`);
  console.log(`  upserted ${statusRows.length} equipment_status rows`);
}

function generateCookieSecret(): string {
  return randomBytes(32).toString("hex");
}

function emitEnvLocalBlock(
  url: string,
  serviceKey: string,
  anonKey: string,
  manifest: ManifestShape
): void {
  const tenantConfig = JSON.stringify({
    business: {
      name: manifest.business_name ?? "Fleet Operator",
      logo_url: "",
      brand_color: manifest.brand_color ?? "#f97316",
      site_title: "Fleet Dashboard (dev)",
    },
    features: {
      visionlink: false,
      samsara: false,
      quickbooks: false,
      chatbot: false,
    },
  });
  console.log(`
────────────────────────────────────────────────────────────────────
Paste this into template-dashboard/.env.local:
────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_TENANT_CONFIG_JSON='${tenantConfig}'

NEXT_PUBLIC_SUPABASE_URL=${url}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_KEY=${serviceKey}

DASHBOARD_PASSWORD=dev-password
COOKIE_SECRET=${generateCookieSecret()}

# Optional — uncomment if you want the fleet map to render real tiles:
# NEXT_PUBLIC_MAPBOX_TOKEN=pk....
────────────────────────────────────────────────────────────────────

Then:
  cd template-dashboard
  npm install                # if you haven't already
  npm run dev
  # open http://localhost:3000 — log in with DASHBOARD_PASSWORD
`);
}

async function main(): Promise<void> {
  loadDotenv();
  const { manifestPath } = parseArgs();

  let url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
  if (!url || !serviceKey) {
    fail(
      "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.\n" +
        "Find them in Supabase Dashboard → Project Settings → API."
    );
  }
  // The Supabase dashboard shows the URL sometimes with /rest/v1/ appended;
  // supabase-js wants the bare project URL and appends /rest/v1 itself.
  url = url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  if (!anonKey) {
    console.log(
      "(SUPABASE_ANON_KEY not set — final env-block will leave it blank for you to fill in)"
    );
  }

  console.log(`reading manifest: ${manifestPath}`);
  const manifest = parseYaml(readFileSync(manifestPath, "utf8")) as ManifestShape;
  if (!manifest.initial_data) {
    fail("manifest has no initial_data block");
  }
  console.log(`tenant: ${manifest.business_name ?? "(unnamed)"}`);

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await verifySchemaApplied(supabase);
  console.log("✓ schema is applied\n");

  console.log("seeding taxonomies:");
  await seedAll(supabase, manifest.initial_data);

  await insertFakeEquipment(supabase);

  emitEnvLocalBlock(url, serviceKey, anonKey || "<paste-your-anon-key>", manifest);
}

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});
