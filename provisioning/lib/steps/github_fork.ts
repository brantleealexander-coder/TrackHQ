import { GitHubClient } from "../clients/github.ts";
import type { Step, StepContext } from "../steps.ts";

function targetName(slug: string): string {
  return `trackhq-${slug}`;
}

export const githubForkStep: Step = {
  name: "github_fork",
  describe(ctx: StepContext): string {
    const { template_repo_owner, template_repo_name } = ctx.env;
    const dest = `${ctx.manifest.resolved.github_owner}/${targetName(ctx.manifest.slug)}`;
    return `Fork ${template_repo_owner}/${template_repo_name} → ${dest}`;
  },
  async execute(ctx: StepContext): Promise<void> {
    if (!ctx.env.github_token) {
      throw new Error("github_fork: GITHUB_TOKEN is required");
    }
    const client = new GitHubClient(ctx.env.github_token);
    const targetOwner = ctx.manifest.resolved.github_owner;
    const name = targetName(ctx.manifest.slug);

    // Idempotency: if the fork already exists (e.g., from a previous failed
    // run), accept it instead of erroring on "name already taken".
    const existing = await client.getRepo(targetOwner, name);
    let repo;
    if (existing) {
      console.log(`  fork already exists at ${existing.full_name}; reusing`);
      repo = existing;
    } else {
      repo = await client.forkRepo({
        upstream_owner: ctx.env.template_repo_owner,
        upstream_repo: ctx.env.template_repo_name,
        target_owner: targetOwner,
        target_name: name,
      });
      console.log(`  forked to ${repo.full_name}`);
    }

    ctx.state.steps.github_fork = {
      repo_full_name: repo.full_name,
      clone_url: repo.clone_url,
      html_url: repo.html_url,
      completed_at: new Date().toISOString(),
    };
  },
};
