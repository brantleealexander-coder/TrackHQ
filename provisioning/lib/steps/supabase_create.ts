import { SupabaseManagementClient } from "../clients/supabase.ts";
import { saveState } from "../state.ts";
import type { SupabaseCreateResult } from "../state.ts";
import { generateDbPassword } from "../utils/password.ts";
import type { Step, StepContext } from "../steps.ts";

function projectName(slug: string): string {
  return `trackhq-${slug}`;
}

function supabaseUrlFromRef(ref: string): string {
  return `https://${ref}.supabase.co`;
}

export const supabaseCreateStep: Step = {
  name: "supabase_create",
  describe(ctx: StepContext): string {
    const { supabase_org_id, supabase_region } = ctx.manifest.resolved;
    return `Create Supabase project "${projectName(ctx.manifest.slug)}" in org ${supabase_org_id} (region ${supabase_region}); poll until ACTIVE_HEALTHY; capture anon + service_role keys`;
  },
  async execute(ctx: StepContext): Promise<void> {
    if (!ctx.env.supabase_management_token) {
      throw new Error("supabase_create: SUPABASE_MANAGEMENT_TOKEN is required");
    }
    const client = new SupabaseManagementClient(ctx.env.supabase_management_token);

    // Resume support: if a previous run already created the project (we
    // have a partial result with project_ref but no completed_at), skip
    // the POST and continue with the wait + keys fetch. This avoids
    // orphaning paid Supabase projects when the wait phase fails.
    let partial = ctx.state.steps.supabase_create as Partial<SupabaseCreateResult> | undefined;

    if (!partial?.project_ref) {
      const db_password = generateDbPassword();
      console.log(`  creating project "${projectName(ctx.manifest.slug)}"...`);
      const created = await client.createProject({
        name: projectName(ctx.manifest.slug),
        organization_id: ctx.manifest.resolved.supabase_org_id,
        region: ctx.manifest.resolved.supabase_region,
        db_pass: db_password,
      });
      console.log(`  created (ref=${created.ref}, status=${created.status})`);
      partial = {
        project_ref: created.ref,
        db_password,
        supabase_url: supabaseUrlFromRef(created.ref),
      };
      // Persist BEFORE the long wait — if we crash mid-poll, the next run
      // will see the project_ref and skip creating a new project.
      ctx.state.steps.supabase_create = partial as SupabaseCreateResult;
      saveState(ctx.state);
    } else {
      console.log(`  reusing in-progress project ref=${partial.project_ref}`);
    }

    if (!partial.anon_key || !partial.service_role_key) {
      console.log(`  waiting for project to become ACTIVE_HEALTHY...`);
      await client.waitUntilHealthy(partial.project_ref!, {
        onPoll: (status) => console.log(`    status: ${status}`),
      });
      console.log(`  fetching api keys...`);
      const keys = await client.getApiKeys(partial.project_ref!);
      partial.anon_key = keys.anon;
      partial.service_role_key = keys.service_role;
    }

    partial.completed_at = new Date().toISOString();
    ctx.state.steps.supabase_create = partial as SupabaseCreateResult;
  },
};
