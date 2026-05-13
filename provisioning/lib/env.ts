/**
 * Light .env loader + token registry.
 *
 * We don't pull in the `dotenv` package — provisioning only needs to read
 * a single file at startup, and a hand-rolled parser keeps the dependency
 * surface tiny.
 *
 * Lines must be KEY=VALUE. Comments (#) and blank lines are ignored.
 * Values may be wrapped in single or double quotes; quotes are stripped.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env");

export interface OperatorEnv {
  // tokens
  github_token: string | null;
  supabase_management_token: string | null;
  vercel_token: string | null;
  railway_token: string | null;
  vapi_api_key: string | null;
  mapbox_public_token: string | null;
  // defaults
  default_github_owner: string | null;
  default_supabase_org_id: string | null;
  default_supabase_region: string | null;
  default_vercel_team_id: string | null;
  default_railway_team_id: string | null;
  default_twilio_area_code: string | null;
  // template source
  template_repo_owner: string;
  template_repo_name: string;
}

function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
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
    out[key] = value;
  }
  return out;
}

function pick(
  parsed: Record<string, string>,
  key: string
): string | null {
  const v = parsed[key] ?? process.env[key];
  return v && v.length > 0 ? v : null;
}

export function loadOperatorEnv(): OperatorEnv {
  let parsed: Record<string, string> = {};
  if (existsSync(ENV_PATH)) {
    parsed = parseDotenv(readFileSync(ENV_PATH, "utf8"));
  }
  return {
    github_token: pick(parsed, "GITHUB_TOKEN"),
    supabase_management_token: pick(parsed, "SUPABASE_MANAGEMENT_TOKEN"),
    vercel_token: pick(parsed, "VERCEL_TOKEN"),
    railway_token: pick(parsed, "RAILWAY_TOKEN"),
    vapi_api_key: pick(parsed, "VAPI_API_KEY"),
    mapbox_public_token: pick(parsed, "MAPBOX_PUBLIC_TOKEN"),
    default_github_owner: pick(parsed, "DEFAULT_GITHUB_OWNER"),
    default_supabase_org_id: pick(parsed, "DEFAULT_SUPABASE_ORG_ID"),
    default_supabase_region: pick(parsed, "DEFAULT_SUPABASE_REGION"),
    default_vercel_team_id: pick(parsed, "DEFAULT_VERCEL_TEAM_ID"),
    default_railway_team_id: pick(parsed, "DEFAULT_RAILWAY_TEAM_ID"),
    default_twilio_area_code: pick(parsed, "DEFAULT_TWILIO_AREA_CODE"),
    template_repo_owner: pick(parsed, "TEMPLATE_REPO_OWNER") ?? "brantlee-alexander",
    template_repo_name: pick(parsed, "TEMPLATE_REPO_NAME") ?? "TrackHQ",
  };
}

/**
 * Tokens required for actually running provisioning (non-dry-run). Each
 * step checks only the tokens it needs, but startup validation reports
 * everything missing up-front so the operator can fix .env in one pass.
 */
export function missingRequiredTokens(env: OperatorEnv): string[] {
  const missing: string[] = [];
  if (!env.github_token) missing.push("GITHUB_TOKEN");
  if (!env.supabase_management_token) missing.push("SUPABASE_MANAGEMENT_TOKEN");
  if (!env.vercel_token) missing.push("VERCEL_TOKEN");
  if (!env.railway_token) missing.push("RAILWAY_TOKEN");
  if (!env.vapi_api_key) missing.push("VAPI_API_KEY");
  if (!env.mapbox_public_token) missing.push("MAPBOX_PUBLIC_TOKEN");
  return missing;
}
