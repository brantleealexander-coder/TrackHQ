import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const runbookStep: Step = {
  name: "runbook",
  describe(ctx: StepContext): string {
    const items = [
      ctx.manifest.resolved.domain ? "DNS for custom domain" : "(no custom domain configured)",
      "Twilio phone number purchase + connect to VAPI assistant",
      ctx.manifest.features?.google_calendar ? "Google Calendar OAuth (credentials.json + token.json on Railway disk)" : null,
      ctx.manifest.features?.twilio_sms ? "Twilio SMS notification number" : null,
      ctx.manifest.features?.telegram_alerts ? "Telegram bot + channel ID" : null,
    ].filter(Boolean);
    return `Emit provisioning/state/${ctx.manifest.slug}.runbook.md covering: ${items.join("; ")}`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("runbook");
  },
};
