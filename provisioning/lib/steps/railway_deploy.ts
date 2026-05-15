import { RailwayClient, RailwayError } from "../clients/railway.ts";
import type { Step, StepContext } from "../steps.ts";

export const railwayDeployStep: Step = {
  name: "railway_deploy",
  describe(_ctx: StepContext): string {
    return `Wait for the first Railway deployment to succeed; generate *.up.railway.app domain`;
  },
  async execute(ctx: StepContext): Promise<void> {
    if (!ctx.env.railway_token) {
      throw new Error("railway_deploy: RAILWAY_TOKEN is required");
    }
    const rc = ctx.state.steps.railway_create;
    if (!rc?.service_id || !rc.environment_id) {
      throw new Error(
        "railway_deploy: railway_create must complete first (no service/environment ids)"
      );
    }
    const client = new RailwayClient(ctx.env.railway_token);

    console.log(`  waiting for first deployment of service ${rc.service_id} to succeed...`);
    const deployment = await client.waitForDeployment({
      serviceId: rc.service_id,
      environmentId: rc.environment_id,
      onPoll: (d) =>
        console.log(`    status: ${d?.status ?? "no deployment yet"}`),
    });
    console.log(`  deployment ${deployment.id} succeeded`);

    // Now expose the service publicly.
    let domain: string;
    try {
      const result = await client.createServiceDomain({
        serviceId: rc.service_id,
        environmentId: rc.environment_id,
      });
      domain = result.domain;
    } catch (err) {
      // Re-running this step may produce a "domain already exists" error.
      // If so, prefer the staticUrl Railway reports on the deployment itself.
      if (err instanceof RailwayError && deployment.staticUrl) {
        domain = deployment.staticUrl.replace(/^https?:\/\//, "");
      } else {
        throw err;
      }
    }

    const public_url = domain.startsWith("http") ? domain : `https://${domain}`;
    console.log(`  public URL: ${public_url}`);

    ctx.state.steps.railway_deploy = {
      public_url,
      completed_at: new Date().toISOString(),
    };
  },
};
