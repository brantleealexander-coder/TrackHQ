import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const railwayEnvsStep: Step = {
  name: "railway_envs",
  describe(_ctx: StepContext): string {
    return `Set Railway env vars: SUPABASE_URL, SUPABASE_KEY (service role), VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_WEBHOOK_URL (placeholder until first deploy URL is known)`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("railway_envs");
  },
};
