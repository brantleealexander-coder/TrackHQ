import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const vapiCreateStep: Step = {
  name: "vapi_create",
  describe(ctx: StepContext): string {
    return `Create VAPI assistant for ${ctx.manifest.business_name} (placeholder webhook URL; PATCHed in step vapi_webhook_update once Railway URL is known)`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("vapi_create");
  },
};
