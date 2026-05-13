import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const vapiPatchStep: Step = {
  name: "vapi_patch",
  describe(_ctx: StepContext): string {
    return `Render template-server/vapi_assistant_config.example.json from the customer's business_config and PATCH the assistant (still with placeholder webhook URL)`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("vapi_patch");
  },
};
