import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const vercelEnvsStep: Step = {
  name: "vercel_envs",
  describe(_ctx: StepContext): string {
    return `Set Vercel env vars: NEXT_PUBLIC_TENANT_CONFIG_JSON, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_MAPBOX_TOKEN`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("vercel_envs");
  },
};
