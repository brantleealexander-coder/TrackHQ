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
 *   Defaults to examples/generic-rental/customer-manifest.yaml. Pass
 *   `--manifest=<path>` to use a different one (e.g. examples/crossmar/).
 *
 * What it does:
 *   - Seeds categories / statuses / locations from manifest.initial_data
 *   - Seeds equipment + equipment_status from manifest.demo_data.equipment
 *   - Seeds customers from manifest.demo_data.customers
 *   - Generates a couple of demo orders + order_lines so the Phase 6
 *     dashboard/calendar/orders pages have content on first load
 *   - Prints the .env.local block for template-dashboard/
 *
 * Idempotent: re-running with the same Supabase URL upserts/overwrites
 * the same dev rows (gl_codes are stable like DEV-001 / GEN-001).
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
    "generic-rental",
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

interface ManifestEquipment {
  gl_code: string;
  serial: string;
  category: string;
  name: string;
  year: number;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
  home_location?: string;
  current_lat?: number;
  current_lng?: number;
  current_address?: string;
  status: string;
  customer?: string;
  rental_end?: string;
}

interface ManifestCustomer {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

interface DemoData {
  equipment?: ManifestEquipment[];
  customers?: ManifestCustomer[];
}

interface ManifestShape {
  business_name?: string;
  brand_color?: string;
  initial_data?: Parameters<typeof seedAll>[1];
  demo_data?: DemoData;
}

async function verifySchemaApplied(supabase: SupabaseClient): Promise<void> {
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

  // Phase 6a: also probe for the new tables so a partially-migrated fork
  // fails fast instead of silently skipping the order/customer seed.
  const { error: customersErr } = await supabase.from("customers").select("id").limit(1);
  if (customersErr && (customersErr.message.includes("does not exist") || customersErr.code === "42P01")) {
    fail(
      `Phase 6a tables missing (customers/orders/...). Re-paste the latest\n` +
        `template-dashboard/supabase_schema.sql into the Supabase SQL Editor.`
    );
  }
}

async function insertEquipment(
  supabase: SupabaseClient,
  units: ManifestEquipment[]
): Promise<Map<string, number>> {
  const { data: cats, error: catsErr } = await supabase.from("categories").select("id, name");
  if (catsErr) fail(`reading categories: ${catsErr.message}`);
  const catByName = new Map((cats ?? []).map((c) => [c.name, c.id as number]));

  const { data: locs, error: locsErr } = await supabase.from("locations").select("id, name");
  if (locsErr) fail(`reading locations: ${locsErr.message}`);
  const locByName = new Map((locs ?? []).map((l) => [l.name, l.id as number]));

  console.log(`\ninserting ${units.length} equipment rows from manifest...`);

  const present = units.filter((u) => {
    if (!catByName.has(u.category)) {
      console.log(`  skipping ${u.gl_code} (category "${u.category}" not in manifest)`);
      return false;
    }
    return true;
  });

  const equipmentRows = present.map((u) => ({
    gl_code: u.gl_code,
    serial_number: u.serial,
    category_id: catByName.get(u.category)!,
    equipment_name: u.name,
    year: u.year,
    rate_daily: u.rate_daily,
    rate_weekly: u.rate_weekly,
    rate_monthly: u.rate_monthly,
    home_location_id: u.home_location ? (locByName.get(u.home_location) ?? null) : null,
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
    status: u.status,
    customer_name: u.customer ?? null,
    rental_end: u.rental_end ?? null,
    rate_type: u.rental_end ? "monthly" : null,
  }));

  const { error: statErr } = await supabase
    .from("equipment_status")
    .upsert(statusRows, { onConflict: "equipment_id" });
  if (statErr) fail(`equipment_status upsert: ${statErr.message}`);
  console.log(`  upserted ${statusRows.length} equipment_status rows`);

  return idByGl;
}

async function insertCustomers(
  supabase: SupabaseClient,
  customers: ManifestCustomer[]
): Promise<Map<string, number>> {
  if (customers.length === 0) return new Map();

  console.log(`\ninserting ${customers.length} demo customers...`);

  // No unique constraint on email at the schema level (so voice flows can
  // insert with no email), but for the dev seed we dedupe by name before
  // upserting so re-runs don't pile up duplicates.
  const { data: existing, error: existErr } = await supabase
    .from("customers")
    .select("id, name");
  if (existErr) fail(`reading customers: ${existErr.message}`);
  const idByName = new Map<string, number>(
    (existing ?? []).map((c) => [c.name, c.id as number])
  );

  const toInsert = customers
    .filter((c) => !idByName.has(c.name))
    .map((c) => ({
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      company: c.company ?? null,
    }));

  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from("customers")
      .insert(toInsert)
      .select("id, name");
    if (insErr) fail(`customer insert: ${insErr.message}`);
    for (const c of inserted ?? []) {
      idByName.set(c.name, c.id as number);
    }
    console.log(`  inserted ${inserted?.length ?? 0} new customers`);
  } else {
    console.log(`  all customers already present — no-op`);
  }

  return idByName;
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function insertDemoOrders(
  supabase: SupabaseClient,
  units: ManifestEquipment[],
  equipmentIdByGl: Map<string, number>,
  customerIdByName: Map<string, number>
): Promise<void> {
  if (customerIdByName.size === 0) return;

  // Build orders from manifest equipment that already names a customer:
  //   status=on_rent   → active order, started 7 days ago, ends in 14
  //   status=reserved  → upcoming order, starts in 7 days, ends in 21
  // One order per (customer, status) bucket; multiple equipment for the
  // same customer get bundled into one multi-line order so the demo
  // shows off the Booqable-style "one order = many assets" pattern.

  const buckets = new Map<string, { customer: string; status: string; lines: ManifestEquipment[] }>();
  for (const u of units) {
    if (!u.customer) continue;
    if (!customerIdByName.has(u.customer)) continue;
    if (!equipmentIdByGl.has(u.gl_code)) continue;
    if (u.status !== "on_rent" && u.status !== "reserved") continue;
    const key = `${u.customer}::${u.status}`;
    if (!buckets.has(key)) buckets.set(key, { customer: u.customer, status: u.status, lines: [] });
    buckets.get(key)!.lines.push(u);
  }

  if (buckets.size === 0) {
    console.log(`\nno demo orders to generate (no equipment has a customer + on_rent/reserved status)`);
    return;
  }

  console.log(`\ninserting ${buckets.size} demo orders...`);

  // Check if any orders are already seeded so we can avoid duplicating on
  // re-runs. Anchored on a sentinel notes prefix per (customer, status).
  const { data: existingOrders } = await supabase
    .from("orders")
    .select("id, notes")
    .like("notes", "demo-seed::%");
  const seenSentinels = new Set<string>(
    (existingOrders ?? []).map((o) => (o.notes as string) ?? "")
  );

  for (const { customer, status, lines } of buckets.values()) {
    const sentinel = `demo-seed::${customer}::${status}`;
    if (seenSentinels.has(sentinel)) {
      console.log(`  skipping ${sentinel} (already seeded)`);
      continue;
    }

    const isActive = status === "on_rent";
    const rentalStart = isoDate(isActive ? -7 : 7);
    const rentalEnd = isoDate(isActive ? 14 : 21);
    const orderStatus = isActive ? "active" : "upcoming";
    const days = isActive ? 21 : 14;
    const total = lines.reduce(
      (sum, l) => sum + (l.rate_daily ?? 0) * days,
      0
    );

    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customerIdByName.get(customer)!,
        status: orderStatus,
        rental_start: rentalStart,
        rental_end: rentalEnd,
        total,
        source: "operator",
        notes: sentinel,
      })
      .select("id")
      .single();
    if (orderErr) {
      console.warn(`  order insert failed for ${customer}/${status}: ${orderErr.message}`);
      continue;
    }

    const orderLines = lines.map((l) => ({
      order_id: orderRow.id as number,
      equipment_id: equipmentIdByGl.get(l.gl_code)!,
      rate_type: "daily",
      rate_amount: l.rate_daily,
      line_total: (l.rate_daily ?? 0) * days,
    }));

    const { error: lineErr } = await supabase.from("order_lines").insert(orderLines);
    if (lineErr) {
      console.warn(`  order_lines insert failed for order ${orderRow.id}: ${lineErr.message}`);
      continue;
    }

    console.log(`  order ${orderRow.id}: ${customer} · ${orderStatus} · ${lines.length} line(s) · $${total.toLocaleString()}`);
  }
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
      name: manifest.business_name ?? "Rental Operator",
      logo_url: "",
      brand_color: manifest.brand_color ?? "#1e40af",
      site_title: manifest.business_name ?? "TrackHQ",
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

  const demo = manifest.demo_data ?? {};
  const equipmentIdByGl = await insertEquipment(supabase, demo.equipment ?? []);
  const customerIdByName = await insertCustomers(supabase, demo.customers ?? []);
  await insertDemoOrders(
    supabase,
    demo.equipment ?? [],
    equipmentIdByGl,
    customerIdByName
  );

  emitEnvLocalBlock(url, serviceKey, anonKey || "<paste-your-anon-key>", manifest);
}

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});
