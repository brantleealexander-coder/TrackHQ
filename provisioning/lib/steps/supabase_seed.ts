import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const supabaseSeedStep: Step = {
  name: "supabase_seed",
  describe(ctx: StepContext): string {
    const init = ctx.manifest.initial_data ?? {};
    const cats = init.categories?.length ?? 0;
    const stats = init.statuses?.length ?? 0;
    const locs = init.locations?.length ?? 0;
    return `Seed taxonomies (${cats} categories, ${stats} statuses, ${locs} locations) via seed-tenant.ts`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("supabase_seed");
  },
};
