import { RailwayClient } from "../clients/railway.ts";
import type { Step, StepContext } from "../steps.ts";
import type { RailwayCreateResult } from "../state.ts";
import { saveState } from "../state.ts";

function projectName(slug: string): string {
  return `trackhq-${slug}`;
}

function serviceName(slug: string): string {
  return `${slug}-receptionist`;
}

function buildVariables(ctx: StepContext): Record<string, string> {
  const supabase = ctx.state.steps.supabase_create;
  const vapi = ctx.state.steps.vapi_create;
  if (!supabase?.supabase_url || !supabase.service_role_key) {
    throw new Error(
      "railway_create: supabase_create must complete first (need supabase_url + service_role_key)"
    );
  }
  if (!vapi?.assistant_id) {
    throw new Error(
      "railway_create: vapi_create must complete first (need assistant_id)"
    );
  }
  if (!ctx.env.vapi_api_key) {
    throw new Error("railway_create: VAPI_API_KEY is required");
  }
  // VAPI_WEBHOOK_URL is a placeholder until railway_deploy assigns the
  // real *.up.railway.app domain. vapi_webhook_update PATCHes the VAPI
  // assistant with the real URL once we know it. The template-server
  // doesn't use VAPI_WEBHOOK_URL itself — it's only here for the operator
  // and for any future startup health-checks.
  return {
    SUPABASE_URL: supabase.supabase_url,
    SUPABASE_KEY: supabase.service_role_key,
    VAPI_API_KEY: ctx.env.vapi_api_key,
    VAPI_ASSISTANT_ID: vapi.assistant_id,
    VAPI_WEBHOOK_URL: "https://placeholder.invalid/webhook/vapi",
    ENVIRONMENT: "production",
  };
}

export const railwayCreateStep: Step = {
  name: "railway_create",
  describe(ctx: StepContext): string {
    const team = ctx.manifest.resolved.railway_team_id
      ? `team ${ctx.manifest.resolved.railway_team_id}`
      : "personal account";
    return `Create Railway project "${projectName(ctx.manifest.slug)}" in ${team}; add service from the fork (root=template-server/); upsert env vars`;
  },
  async execute(ctx: StepContext): Promise<void> {
    if (!ctx.env.railway_token) {
      throw new Error("railway_create: RAILWAY_TOKEN is required");
    }
    const fork = ctx.state.steps.github_fork;
    if (!fork?.repo_full_name) {
      throw new Error("railway_create: github_fork must complete first");
    }

    const client = new RailwayClient(ctx.env.railway_token);
    let partial = ctx.state.steps.railway_create as Partial<RailwayCreateResult> | undefined;

    // Step A: project + environment
    if (!partial?.project_id) {
      console.log(`  creating project "${projectName(ctx.manifest.slug)}"`);
      const { projectId, productionEnvironmentId } = await client.createProject({
        name: projectName(ctx.manifest.slug),
        teamId: ctx.manifest.resolved.railway_team_id,
      });
      partial = {
        project_id: projectId,
        environment_id: productionEnvironmentId,
        service_id: "",
      };
      ctx.state.steps.railway_create = partial as RailwayCreateResult;
      saveState(ctx.state);
      console.log(`  created project ${projectId} (env ${productionEnvironmentId})`);
    }

    // Step B: service from git repo
    if (!partial.service_id) {
      console.log(`  creating service ${serviceName(ctx.manifest.slug)} from ${fork.repo_full_name}`);
      const { serviceId } = await client.createServiceFromRepo({
        projectId: partial.project_id!,
        name: serviceName(ctx.manifest.slug),
        repo: fork.repo_full_name,
        branch: "main",
      });
      partial.service_id = serviceId;
      ctx.state.steps.railway_create = partial as RailwayCreateResult;
      saveState(ctx.state);

      // Step C: set rootDirectory so Railway only builds template-server/
      await client.updateServiceInstance({
        serviceId,
        environmentId: partial.environment_id!,
        rootDirectory: "template-server",
      });
      console.log(`  service ${serviceId} rootDirectory=template-server`);
    }

    // Step D: env vars
    const variables = buildVariables(ctx);
    await client.upsertVariables({
      projectId: partial.project_id!,
      environmentId: partial.environment_id!,
      serviceId: partial.service_id!,
      variables,
    });
    console.log(`  upserted ${Object.keys(variables).length} env vars`);

    partial.completed_at = new Date().toISOString();
    ctx.state.steps.railway_create = partial as RailwayCreateResult;
  },
};
