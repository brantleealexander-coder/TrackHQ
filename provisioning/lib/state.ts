/**
 * State persistence for provision-customer.ts.
 *
 * Each provisioning run writes its progress to `provisioning/state/<slug>.json`
 * after every successful step, so a rerun can skip work that already completed
 * and pick up where a failed run left off.
 *
 * NOTE: state files contain secrets (db_password, service_role_key, vapi
 * assistant id). The directory is gitignored at both provisioning/.gitignore
 * and the repo root.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "..", "state");

export type StepName =
  | "github_fork"
  | "supabase_create"
  | "supabase_schema"
  | "supabase_seed"
  | "vapi_create"
  | "vapi_patch"
  | "vercel_create"
  | "vercel_envs"
  | "vercel_deploy"
  | "railway_create"
  | "railway_envs"
  | "railway_deploy"
  | "vapi_webhook_update"
  | "runbook";

export interface GithubForkResult {
  repo_full_name: string;
  clone_url: string;
  html_url: string;
  completed_at: string;
}

export interface SupabaseCreateResult {
  project_ref: string;
  db_password: string;
  supabase_url: string;
  anon_key: string;
  service_role_key: string;
  completed_at: string;
}

export interface VapiCreateResult {
  assistant_id: string;
  completed_at: string;
}

export interface VercelCreateResult {
  project_id: string;
  project_name: string;
  completed_at: string;
}

export interface VercelDeployResult {
  deployment_url: string;
  completed_at: string;
}

export interface RailwayCreateResult {
  project_id: string;
  service_id: string;
  environment_id: string;
  completed_at: string;
}

export interface RailwayDeployResult {
  public_url: string;
  completed_at: string;
}

export interface SimpleStepResult {
  completed_at: string;
}

export interface RunbookResult {
  path: string;
  completed_at: string;
}

export interface State {
  slug: string;
  created_at: string;
  updated_at: string;
  steps: Partial<{
    github_fork: GithubForkResult;
    supabase_create: SupabaseCreateResult;
    supabase_schema: SimpleStepResult;
    supabase_seed: SimpleStepResult;
    vapi_create: VapiCreateResult;
    vapi_patch: SimpleStepResult;
    vercel_create: VercelCreateResult;
    vercel_envs: SimpleStepResult;
    vercel_deploy: VercelDeployResult;
    railway_create: RailwayCreateResult;
    railway_envs: SimpleStepResult;
    railway_deploy: RailwayDeployResult;
    vapi_webhook_update: SimpleStepResult;
    runbook: RunbookResult;
  }>;
}

function statePath(slug: string): string {
  return join(STATE_DIR, `${slug}.json`);
}

export function loadState(slug: string): State {
  const path = statePath(slug);
  if (!existsSync(path)) {
    const now = new Date().toISOString();
    return { slug, created_at: now, updated_at: now, steps: {} };
  }
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as State;
}

export function saveState(state: State): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  state.updated_at = new Date().toISOString();
  writeFileSync(statePath(state.slug), JSON.stringify(state, null, 2) + "\n");
}

export function isStepComplete(state: State, step: StepName): boolean {
  // A step is "complete" only if it ran end-to-end and set `completed_at`.
  // Some steps (e.g., supabase_create with its slow poll) persist partial
  // results mid-execution — those don't count as complete and a resume
  // run picks them back up rather than re-creating the resource.
  const result = state.steps[step] as { completed_at?: string } | undefined;
  return result?.completed_at !== undefined;
}

export function markStep<K extends StepName>(
  state: State,
  step: K,
  result: NonNullable<State["steps"][K]>
): void {
  state.steps[step] = result;
  saveState(state);
}
