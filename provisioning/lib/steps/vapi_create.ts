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

const PLACEHOLDER_WEBHOOK_URL = "https://placeholder.invalid/webhook/vapi";

function assistantName(slug: string): string {
  return `trackhq-${slug}-receptionist`;
}

export const vapiCreateStep: Step = {
  name: "vapi_create",
  describe(ctx: StepContext): string {
    return `Create VAPI assistant for ${ctx.manifest.business_name} (placeholder webhook URL; PATCHed in vapi_webhook_update once Railway URL is known)`;
  },
  async execute(ctx: StepContext): Promise<void> {
    if (!ctx.env.vapi_api_key) {
      throw new Error("vapi_create: VAPI_API_KEY is required");
    }
    const client = new VapiClient(ctx.env.vapi_api_key);
    const name = assistantName(ctx.manifest.slug);

    // Render the template with placeholder webhook URL. The real Railway URL
    // is PATCHed in by `vapi_webhook_update` after `railway_deploy` completes.
    const template = readFileSync(TEMPLATE_PATH, "utf8");
    const subs = buildVapiSubstitutions(ctx.manifest);
    const config = renderVapiTemplate(template, subs, PLACEHOLDER_WEBHOOK_URL) as Record<string, unknown>;
    config.name = name;

    // Idempotency: if a previous run created an assistant with this name
    // but didn't persist its id (e.g. network blip between POST and save),
    // find and reuse it instead of creating a duplicate.
    const existing = await client.listAssistants();
    const reuse = existing.find((a) => a.name === name);

    let assistantId: string;
    if (reuse) {
      console.log(`  found existing assistant ${reuse.id} (${name}); reusing`);
      assistantId = reuse.id;
      // Re-apply our rendered config so a partially-configured assistant
      // ends up in the expected state.
      await client.patchAssistant(assistantId, config);
    } else {
      console.log(`  creating assistant "${name}"`);
      const created = await client.createAssistant(config);
      assistantId = created.id;
      console.log(`  created assistant ${assistantId}`);
    }

    ctx.state.steps.vapi_create = {
      assistant_id: assistantId,
      completed_at: new Date().toISOString(),
    };
  },
};
