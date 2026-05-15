import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderRunbook } from "../runbook.ts";
import type { Step, StepContext } from "../steps.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "..", "..", "state");

export const runbookStep: Step = {
  name: "runbook",
  describe(ctx: StepContext): string {
    return `Emit provisioning/state/${ctx.manifest.slug}.runbook.md with the remaining manual steps`;
  },
  async execute(ctx: StepContext): Promise<void> {
    const content = renderRunbook(ctx.manifest, ctx.state);
    mkdirSync(STATE_DIR, { recursive: true });
    const path = resolve(STATE_DIR, `${ctx.manifest.slug}.runbook.md`);
    writeFileSync(path, content);
    console.log(`  wrote ${path}`);
    ctx.state.steps.runbook = {
      path,
      completed_at: new Date().toISOString(),
    };
  },
};
