import { VercelClient, type VercelEnvVar } from "../clients/vercel.ts";
import type { Step, StepContext } from "../steps.ts";
import type { ResolvedManifest } from "../manifest.ts";

function projectName(slug: string): string {
  return `trackhq-${slug}`;
}

/**
 * Build the NEXT_PUBLIC_TENANT_CONFIG_JSON value from the manifest. The
 * dashboard's tenant-config.ts (Phase 1) reads this env var to pick up
 * branding + feature toggles + contact info.
 */
function tenantConfigJson(manifest: ResolvedManifest): string {
  return JSON.stringify({
    slug: manifest.slug,
    business_name: manifest.business_name,
    brand_color: manifest.brand_color ?? "#1e40af",
    logo_url: manifest.logo_url ?? null,
    site_title: manifest.site_title ?? manifest.business_name,
    contact: manifest.contact ?? null,
    features: manifest.features ?? {},
  });
}

function buildEnvVars(ctx: StepContext): VercelEnvVar[] {
  const supabase = ctx.state.steps.supabase_create;
  if (!supabase?.supabase_url || !supabase.anon_key || !supabase.service_role_key) {
    throw new Error(
      "vercel_create: supabase_create must complete first (missing url/anon/service_role in state)"
    );
  }
  if (!ctx.env.mapbox_public_token) {
    throw new Error("vercel_create: MAPBOX_PUBLIC_TOKEN is required for the fleet map");
  }
  const target: VercelEnvVar["target"] = ["production", "preview", "development"];
  return [
    { key: "NEXT_PUBLIC_TENANT_CONFIG_JSON", value: tenantConfigJson(ctx.manifest), type: "encrypted", target },
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: supabase.supabase_url, type: "encrypted", target },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: supabase.anon_key, type: "encrypted", target },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: supabase.service_role_key, type: "encrypted", target },
    { key: "NEXT_PUBLIC_MAPBOX_TOKEN", value: ctx.env.mapbox_public_token, type: "encrypted", target },
  ];
}

export const vercelCreateStep: Step = {
  name: "vercel_create",
  describe(ctx: StepContext): string {
    const team = ctx.manifest.resolved.vercel_team_id
      ? `team ${ctx.manifest.resolved.vercel_team_id}`
      : "personal account";
    return `Create Vercel project "${projectName(ctx.manifest.slug)}" in ${team}, linked to the forked GitHub repo with all dashboard env vars set; auto-deploys`;
  },
  async execute(ctx: StepContext): Promise<void> {
    if (!ctx.env.vercel_token) {
      throw new Error("vercel_create: VERCEL_TOKEN is required");
    }
    const fork = ctx.state.steps.github_fork;
    if (!fork?.repo_full_name) {
      throw new Error("vercel_create: github_fork must complete first (no repo_full_name)");
    }

    const client = new VercelClient(
      ctx.env.vercel_token,
      ctx.manifest.resolved.vercel_team_id
    );
    const name = projectName(ctx.manifest.slug);
    const envVars = buildEnvVars(ctx);

    let project = await client.getProject(name);
    if (project) {
      console.log(`  project ${name} already exists (id=${project.id}); upserting env vars`);
      await client.upsertEnvVars(project.id, envVars);
    } else {
      console.log(`  creating project ${name} linked to ${fork.repo_full_name}`);
      project = await client.createProject({
        name,
        gitRepository: { type: "github", repo: fork.repo_full_name },
        rootDirectory: "template-dashboard",
        environmentVariables: envVars,
      });
      console.log(`  created project id=${project.id}; auto-deploy started`);
    }

    ctx.state.steps.vercel_create = {
      project_id: project.id,
      project_name: project.name,
      default_domain: `${project.name}.vercel.app`,
      completed_at: new Date().toISOString(),
    };
  },
};
