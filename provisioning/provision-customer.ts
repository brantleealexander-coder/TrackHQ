/**
 * provision-customer.ts — end-to-end TrackHQ tenant provisioning.
 *
 * Reads a customer-manifest.yaml, then walks the step list defined in
 * lib/steps.ts to spin up GitHub fork + Supabase + Vercel + Railway + VAPI
 * for that tenant. Persists progress to provisioning/state/<slug>.json after
 * every successful step so re-running picks up where a failure left off.
 *
 * Usage:
 *   tsx provision-customer.ts <manifest.yaml>            # do it
 *   tsx provision-customer.ts <manifest.yaml> --dry-run  # print the plan
 *   tsx provision-customer.ts <manifest.yaml> --resume   # skip completed steps
 *   tsx provision-customer.ts <manifest.yaml> --only=supabase_create,supabase_schema
 *
 * Tokens come from provisioning/.env (see .env.example). Default values
 * (org IDs, regions) come from the same file; per-customer overrides live
 * in the manifest's `provisioning:` block.
 */

import { loadOperatorEnv, missingRequiredTokens } from "./lib/env.ts";
import { loadManifest } from "./lib/manifest.ts";
import { isStepComplete, loadState, saveState } from "./lib/state.ts";
import { STEPS, NotYetImplementedError } from "./lib/steps.ts";
import type { Step, StepContext } from "./lib/steps.ts";

interface Args {
  manifestPath: string;
  dryRun: boolean;
  resume: boolean;
  only: Set<string> | null;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const positional: string[] = [];
  let dryRun = false;
  let resume = false;
  let only: Set<string> | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--resume") resume = true;
    else if (arg.startsWith("--only=")) {
      only = new Set(arg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean));
    } else if (arg.startsWith("--")) {
      fail(`unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    fail(
      "usage: tsx provision-customer.ts <path/to/customer-manifest.yaml> [--dry-run] [--resume] [--only=step1,step2]"
    );
  }
  return { manifestPath: positional[0], dryRun, resume, only };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function printPlan(steps: Step[], ctx: StepContext): void {
  console.log("\nProvisioning plan:");
  console.log("─".repeat(70));
  for (const [i, step] of steps.entries()) {
    const num = pad(`${i + 1}.`, 4);
    const name = pad(step.name, 22);
    const status = isStepComplete(ctx.state, step.name) ? "[done] " : "       ";
    console.log(`${num}${status}${name}${step.describe(ctx)}`);
  }
  console.log("─".repeat(70));
}

async function runSteps(steps: Step[], ctx: StepContext, resume: boolean): Promise<void> {
  for (const [i, step] of steps.entries()) {
    if (resume && isStepComplete(ctx.state, step.name)) {
      console.log(`\n[${i + 1}/${steps.length}] ${step.name}: already complete, skipping`);
      continue;
    }
    console.log(`\n[${i + 1}/${steps.length}] ${step.name}: ${step.describe(ctx)}`);
    try {
      await step.execute(ctx);
      saveState(ctx.state);
      console.log(`  ✓ ${step.name} complete`);
    } catch (err) {
      if (err instanceof NotYetImplementedError) {
        console.error(`  ✗ ${step.name}: ${err.message}`);
        console.error("\nState saved at provisioning/state/" + ctx.manifest.slug + ".json");
        console.error("Re-run with --resume once the integration is implemented.");
        process.exit(2);
      }
      throw err;
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  const env = loadOperatorEnv();
  const manifest = loadManifest(args.manifestPath, env);
  const state = loadState(manifest.slug);

  console.log(`tenant:    ${manifest.business_name} [${manifest.slug}]`);
  console.log(`manifest:  ${args.manifestPath}`);
  console.log(`mode:      ${args.dryRun ? "DRY RUN — no API calls" : args.resume ? "RESUME" : "EXECUTE"}`);

  if (!args.dryRun) {
    const missing = missingRequiredTokens(env);
    if (missing.length > 0) {
      fail(
        `provisioning/.env is missing required tokens:\n  - ${missing.join("\n  - ")}\n\nUse --dry-run to validate the plan without API calls.`
      );
    }
  }

  let steps = STEPS;
  if (args.only) {
    steps = STEPS.filter((s) => args.only!.has(s.name));
    if (steps.length === 0) {
      fail(`--only matched no steps. Known steps: ${STEPS.map((s) => s.name).join(", ")}`);
    }
  }

  const ctx: StepContext = { env, manifest, state, dryRun: args.dryRun };

  if (args.dryRun) {
    printPlan(steps, ctx);
    console.log("\nDry run complete. No external services were contacted.");
    return;
  }

  printPlan(steps, ctx);
  await runSteps(steps, ctx, args.resume);
  console.log("\n✓ Provisioning complete.");
  console.log(`State file: provisioning/state/${manifest.slug}.json`);
  if (state.steps.runbook) {
    console.log(`Runbook:    ${state.steps.runbook.path}`);
  }
}

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});
