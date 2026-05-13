import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const railwayDeployStep: Step = {
  name: "railway_deploy",
  describe(_ctx: StepContext): string {
    return `Trigger Railway deployment; poll until healthy; capture the *.up.railway.app public URL`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("railway_deploy");
  },
};
