import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const supabaseCreateStep: Step = {
  name: "supabase_create",
  describe(ctx: StepContext): string {
    const { supabase_org_id, supabase_region } = ctx.manifest.resolved;
    return `Create Supabase project "trackhq-${ctx.manifest.slug}" in org ${supabase_org_id} (region ${supabase_region}); poll until ACTIVE_HEALTHY; capture anon + service_role keys`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("supabase_create");
  },
};
