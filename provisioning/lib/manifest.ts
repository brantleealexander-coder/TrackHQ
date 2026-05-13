/**
 * Parse + validate the full customer-manifest.yaml for provision-customer.ts.
 *
 * seed-tenant.ts only reads `initial_data`; this module reads everything
 * and produces a fully-resolved view where per-customer overrides have been
 * merged with operator-level defaults from .env.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { OperatorEnv } from "./env.ts";

const ALLOWED_BEHAVIORS = [
  "rented",
  "available",
  "out_of_service",
  "reserved",
  "pending_return",
] as const;
type Behavior = (typeof ALLOWED_BEHAVIORS)[number];

const SLUG_RE = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export interface StatusManifest {
  key: string;
  name: string;
  color: string;
  behavior: Behavior;
  sort_order?: number;
}

export interface LocationManifest {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ContactBlock {
  phone?: string;
  email?: string;
  website?: string;
}

export interface FeaturesBlock {
  visionlink?: boolean;
  samsara?: boolean;
  quickbooks?: boolean;
  chatbot?: boolean;
  google_calendar?: boolean;
  twilio_sms?: boolean;
  telegram_alerts?: boolean;
}

export interface ProvisioningBlock {
  github_owner?: string | null;
  supabase_org_id?: string | null;
  supabase_region?: string | null;
  vercel_team_id?: string | null;
  railway_team_id?: string | null;
  domain?: string | null;
  twilio_area_code?: string | null;
}

export interface RawManifest {
  slug: string;
  business_name: string;
  brand_color?: string;
  logo_url?: string;
  site_title?: string;
  contact?: ContactBlock;
  features?: FeaturesBlock;
  provisioning?: ProvisioningBlock;
  initial_data?: {
    categories?: string[];
    statuses?: StatusManifest[];
    locations?: LocationManifest[];
  };
}

/**
 * Manifest after merging per-customer overrides with operator defaults.
 * All provisioning fields are guaranteed non-null where the step needs them
 * (validated at load time, not at step time).
 */
export interface ResolvedManifest extends RawManifest {
  resolved: {
    github_owner: string;
    supabase_org_id: string;
    supabase_region: string;
    vercel_team_id: string | null; // null = personal account
    railway_team_id: string | null;
    domain: string | null;
    twilio_area_code: string | null;
  };
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function validateRaw(raw: unknown): RawManifest {
  if (typeof raw !== "object" || raw === null) {
    fail("manifest must be a YAML object");
  }
  const m = raw as RawManifest;

  if (!m.slug || typeof m.slug !== "string") fail("manifest is missing slug");
  if (!SLUG_RE.test(m.slug)) {
    fail(
      `slug "${m.slug}" must be 3-40 chars, lowercase alphanumeric and hyphens, starting with a letter`
    );
  }
  if (!m.business_name || typeof m.business_name !== "string") {
    fail("manifest is missing business_name");
  }
  if (m.brand_color && !HEX_COLOR_RE.test(m.brand_color)) {
    fail(`brand_color "${m.brand_color}" must be a 6-digit hex like #1e40af`);
  }

  if (m.initial_data?.statuses) {
    const seen = new Set<string>();
    for (const [i, s] of m.initial_data.statuses.entries()) {
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
      if (seen.has(s.key)) fail(`duplicate status key "${s.key}"`);
      seen.add(s.key);
    }
  }

  return m;
}

export function loadManifest(path: string, env: OperatorEnv): ResolvedManifest {
  const raw = readFileSync(resolve(path), "utf8");
  const parsed = validateRaw(parseYaml(raw));
  const p = parsed.provisioning ?? {};

  const github_owner = p.github_owner ?? env.default_github_owner;
  const supabase_org_id = p.supabase_org_id ?? env.default_supabase_org_id;
  const supabase_region = p.supabase_region ?? env.default_supabase_region;

  const missing: string[] = [];
  if (!github_owner) missing.push("github_owner (or DEFAULT_GITHUB_OWNER)");
  if (!supabase_org_id)
    missing.push("supabase_org_id (or DEFAULT_SUPABASE_ORG_ID)");
  if (!supabase_region) missing.push("supabase_region (or DEFAULT_SUPABASE_REGION)");
  if (missing.length > 0) {
    fail(`manifest is missing required provisioning values:\n  - ${missing.join("\n  - ")}`);
  }

  return {
    ...parsed,
    resolved: {
      github_owner: github_owner!,
      supabase_org_id: supabase_org_id!,
      supabase_region: supabase_region!,
      vercel_team_id: p.vercel_team_id ?? env.default_vercel_team_id,
      railway_team_id: p.railway_team_id ?? env.default_railway_team_id,
      domain: p.domain ?? null,
      twilio_area_code: p.twilio_area_code ?? env.default_twilio_area_code,
    },
  };
}
