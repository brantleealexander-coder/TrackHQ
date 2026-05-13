import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const vercelCreateStep: Step = {
  name: "vercel_create",
  describe(ctx: StepContext): string {
    const team = ctx.manifest.resolved.vercel_team_id
      ? `team ${ctx.manifest.resolved.vercel_team_id}`
      : "personal account";
    return `Create Vercel project "trackhq-${ctx.manifest.slug}" in ${team}, linked to the forked GitHub repo, root directory = template-dashboard/`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("vercel_create");
  },
};
