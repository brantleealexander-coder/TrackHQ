/**
 * Build a minimal StepContext for tests. Only the fields a step actually
 * reads need to be set; everything else gets sensible defaults.
 */

import type { OperatorEnv } from "../../lib/env.ts";
import type { ResolvedManifest } from "../../lib/manifest.ts";
import type { State } from "../../lib/state.ts";
import type { StepContext } from "../../lib/steps.ts";

export function makeEnv(overrides: Partial<OperatorEnv> = {}): OperatorEnv {
  return {
    github_token: "ghp_test",
    supabase_management_token: "sbp_test",
    vercel_token: "vrcl_test",
    railway_token: "rlw_test",
    vapi_api_key: "vapi_test",
    mapbox_public_token: "pk.test",
    default_github_owner: "test-owner",
    default_supabase_org_id: "org_test",
    default_supabase_region: "us-east-1",
    default_vercel_team_id: null,
    default_railway_team_id: null,
    default_twilio_area_code: null,
    template_repo_owner: "brantlee-alexander",
    template_repo_name: "TrackHQ",
    ...overrides,
  };
}

export function makeManifest(
  overrides: Partial<ResolvedManifest> = {}
): ResolvedManifest {
  return {
    slug: "acme-test",
    business_name: "Acme Test",
    brand_color: "#1e40af",
    site_title: "Acme Fleet",
    contact: { phone: "+15551234567", email: "ops@acme.test", website: "https://acme.test" },
    features: { visionlink: false, samsara: false, quickbooks: false, chatbot: true },
    initial_data: {
      categories: ["Excavators", "Trailers"],
      statuses: [
        { key: "on_rent", name: "On Rent", color: "#22c55e", behavior: "rented", sort_order: 10 },
        { key: "available", name: "Available", color: "#3b82f6", behavior: "available", sort_order: 20 },
      ],
      locations: [{ name: "Main Yard", address: "1 Main St", latitude: 32.7, longitude: -96.8 }],
    },
    resolved: {
      github_owner: "test-owner",
      supabase_org_id: "org_test",
      supabase_region: "us-east-1",
      vercel_team_id: null,
      railway_team_id: null,
      domain: null,
      twilio_area_code: null,
    },
    ...overrides,
  };
}

export function makeState(slug = "acme-test"): State {
  const now = new Date().toISOString();
  return { slug, created_at: now, updated_at: now, steps: {} };
}

export function makeContext(overrides: Partial<StepContext> = {}): StepContext {
  return {
    env: makeEnv(),
    manifest: makeManifest(),
    state: makeState(),
    dryRun: false,
    ...overrides,
  };
}
