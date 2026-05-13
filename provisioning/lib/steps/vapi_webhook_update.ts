import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VapiClient } from "../clients/vapi.ts";
import { buildVapiSubstitutions } from "../vapi/business-config.ts";
import { renderVapiTemplate } from "../vapi/render.ts";
import type { Step, StepContext } from "../steps.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "template-server",
  "vapi_assistant_config.example.json"
);

export const vapiWebhookUpdateStep: Step = {
  name: "vapi_webhook_update",
  describe(_ctx: StepContext): string {
    return `Re-render the VAPI template with the real Railway URL and PATCH the assistant (replaces placeholder URLs in serverUrl + every tool.server.url)`;
  },
  async execute(ctx: StepContext): Promise<void> {
    if (!ctx.env.vapi_api_key) {
      throw new Error("vapi_webhook_update: VAPI_API_KEY is required");
    }
    const vapi = ctx.state.steps.vapi_create;
    if (!vapi?.assistant_id) {
      throw new Error(
        "vapi_webhook_update: vapi_create must complete first (no assistant_id in state)"
      );
    }
    const railway = ctx.state.steps.railway_deploy;
    if (!railway?.public_url) {
      throw new Error(
        "vapi_webhook_update: railway_deploy must complete first (no public_url in state)"
      );
    }

    const webhookUrl = `${railway.public_url.replace(/\/$/, "")}/webhook/vapi`;
    console.log(`  patching VAPI assistant ${vapi.assistant_id} webhook → ${webhookUrl}`);

    // Re-render the full template with the real webhook URL. Each tool's
    // `server.url` and the top-level `serverUrl` are all the same placeholder
    // in the template, so a re-render swaps them all in one go.
    const template = readFileSync(TEMPLATE_PATH, "utf8");
    const subs = buildVapiSubstitutions(ctx.manifest);
    const config = renderVapiTemplate(template, subs, webhookUrl);

    const client = new VapiClient(ctx.env.vapi_api_key);
    await client.patchAssistant(vapi.assistant_id, config);

    ctx.state.steps.vapi_webhook_update = {
      completed_at: new Date().toISOString(),
    };
  },
};
