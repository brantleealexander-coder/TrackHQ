import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const vercelDeployStep: Step = {
  name: "vercel_deploy",
  describe(_ctx: StepContext): string {
    return `Trigger initial Vercel deployment; capture the *.vercel.app URL`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("vercel_deploy");
  },
};
