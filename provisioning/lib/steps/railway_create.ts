import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const railwayCreateStep: Step = {
  name: "railway_create",
  describe(ctx: StepContext): string {
    const team = ctx.manifest.resolved.railway_team_id
      ? `team ${ctx.manifest.resolved.railway_team_id}`
      : "personal account";
    return `Create Railway project "trackhq-${ctx.manifest.slug}" in ${team} with one service linked to the fork (root = template-server/)`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("railway_create");
  },
};
