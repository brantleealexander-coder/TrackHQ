import { seedAll, tenantClient } from "../seed-core.ts";
import type { Step, StepContext } from "../steps.ts";

export const supabaseSeedStep: Step = {
  name: "supabase_seed",
  describe(ctx: StepContext): string {
    const init = ctx.manifest.initial_data ?? {};
    const cats = init.categories?.length ?? 0;
    const stats = init.statuses?.length ?? 0;
    const locs = init.locations?.length ?? 0;
    return `Seed taxonomies (${cats} categories, ${stats} statuses, ${locs} locations) via seed-tenant.ts`;
  },
  async execute(ctx: StepContext): Promise<void> {
    const create = ctx.state.steps.supabase_create;
    if (!create?.service_role_key || !create.supabase_url) {
      throw new Error(
        "supabase_seed: supabase_create must complete first (missing service_role_key or supabase_url in state)"
      );
    }
    const init = ctx.manifest.initial_data ?? {};
    const supabase = tenantClient(create.supabase_url, create.service_role_key);
    await seedAll(supabase, init);

    ctx.state.steps.supabase_seed = {
      completed_at: new Date().toISOString(),
    };
  },
};
