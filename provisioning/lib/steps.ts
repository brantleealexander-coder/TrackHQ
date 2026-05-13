/**
 * Step registry — the ordered list of provisioning steps and their
 * dry-run descriptions. Real implementations live in lib/steps/*.ts and
 * fill in `execute` over the course of Phase 4.
 *
 * Why this shape:
 *   - The dry-run plan is just `STEPS.map(s => s.describe(ctx))`. So adding
 *     a step means one entry here + one file.
 *   - State persistence is centralized: orchestrator marks the step
 *     complete after `execute` returns, so step implementations don't
 *     need to remember to call markStep.
 *   - Steps can read prior steps' outputs off `ctx.state.steps` without
 *     coupling to the global state shape — the types in state.ts narrow.
 */

import type { OperatorEnv } from "./env.ts";
import type { ResolvedManifest } from "./manifest.ts";
import type { State, StepName } from "./state.ts";

export interface StepContext {
  env: OperatorEnv;
  manifest: ResolvedManifest;
  state: State;
  dryRun: boolean;
}

export interface Step {
  name: StepName;
  /** One-line description shown in dry-run plan and as the running banner. */
  describe(ctx: StepContext): string;
  /**
   * Run the step against external services. Implementations MUST be idempotent
   * where possible (the orchestrator already skips steps that are recorded
   * complete in state, but a retry mid-step needs to handle "already exists").
   *
   * On success, the implementation writes its result into `ctx.state.steps[name]`
   * (the orchestrator then persists state).
   */
  execute(ctx: StepContext): Promise<void>;
}

import { githubForkStep } from "./steps/github_fork.ts";
import { supabaseCreateStep } from "./steps/supabase_create.ts";
import { supabaseSchemaStep } from "./steps/supabase_schema.ts";
import { supabaseSeedStep } from "./steps/supabase_seed.ts";
import { vapiCreateStep } from "./steps/vapi_create.ts";
import { vercelCreateStep } from "./steps/vercel_create.ts";
import { railwayCreateStep } from "./steps/railway_create.ts";
import { railwayDeployStep } from "./steps/railway_deploy.ts";
import { vapiWebhookUpdateStep } from "./steps/vapi_webhook_update.ts";
import { runbookStep } from "./steps/runbook.ts";

export const STEPS: Step[] = [
  githubForkStep,
  supabaseCreateStep,
  supabaseSchemaStep,
  supabaseSeedStep,
  vapiCreateStep,
  vercelCreateStep,
  railwayCreateStep,
  railwayDeployStep,
  vapiWebhookUpdateStep,
  runbookStep,
];

export class NotYetImplementedError extends Error {
  constructor(stepName: StepName) {
    super(
      `step "${stepName}" is not yet implemented. Use --dry-run to validate the plan, or wait for the integration to land.`
    );
    this.name = "NotYetImplementedError";
  }
}
