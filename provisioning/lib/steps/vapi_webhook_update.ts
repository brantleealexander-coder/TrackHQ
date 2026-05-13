import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const vapiWebhookUpdateStep: Step = {
  name: "vapi_webhook_update",
  describe(_ctx: StepContext): string {
    return `Re-render the VAPI template with the real Railway webhook URL (replacing the placeholder set in vapi_create) and PATCH the assistant`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("vapi_webhook_update");
  },
};
