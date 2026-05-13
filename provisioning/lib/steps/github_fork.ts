import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const githubForkStep: Step = {
  name: "github_fork",
  describe(ctx: StepContext): string {
    const { template_repo_owner, template_repo_name } = ctx.env;
    const dest = `${ctx.manifest.resolved.github_owner}/trackhq-${ctx.manifest.slug}`;
    return `Fork ${template_repo_owner}/${template_repo_name} → ${dest}`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("github_fork");
  },
};
