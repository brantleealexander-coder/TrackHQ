/**
 * Build the VAPI substitution map from a customer manifest + defaults.
 *
 * The manifest's `receptionist:` block (and `contact:`, `business_name`)
 * supplies the per-customer values. Anything missing falls back to a
 * sensible default suitable for a small B2B fleet/rental business.
 *
 * The values returned here go straight into the VAPI template renderer.
 * The deployed template-server keeps a separate business_config.json
 * (for the getBusinessInfo webhook tool to answer FAQs) — populating that
 * file is a runbook step, not part of provisioning automation.
 */

import type { ResolvedManifest } from "../manifest.ts";
import type { VapiSubstitutions } from "./render.ts";

const DEFAULT_VOICE_PROVIDER = "11labs";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // 11labs Rachel
const DEFAULT_RECEPTIONIST_NAME = "Alex";
const DEFAULT_TIMEZONE = "America/Chicago";
const DEFAULT_TRANSFER_MESSAGE = "One moment, I'll connect you with the team.";

function defaultSystemPrompt(
  receptionistName: string,
  businessName: string,
  timezone: string
): string {
  return (
    `You are ${receptionistName}, the friendly AI receptionist for ${businessName}.\n\n` +
    `Today's date and time: {{ "now" | date: "%B %d, %Y, %I:%M %p", "${timezone}" }}\n\n` +
    `Your job is to help callers with appointment booking and answering common questions about the business.\n\n` +
    `Rules:\n` +
    `1. Be warm, concise, and professional.\n` +
    `2. Use getBusinessInfo for any business question — never make up information.\n` +
    `3. Use checkAvailability before bookAppointment.\n` +
    `4. If you cannot help, use takeMessage (after hours) or transferCall (during business hours).\n` +
    `5. Never mention that you are an AI unless directly asked.`
  );
}

function defaultFirstMessage(businessName: string): string {
  return `Thank you for calling ${businessName}, how can I help you today?`;
}

const DEFAULT_ANALYSIS_PROMPT =
  "Summarize this call in one sentence. Include the caller's name if mentioned, what they called about, and what was resolved or left pending.";

export function buildVapiSubstitutions(
  manifest: ResolvedManifest
): VapiSubstitutions {
  const r = manifest.receptionist ?? {};
  const businessName = manifest.business_name;
  const receptionistName = r.name ?? DEFAULT_RECEPTIONIST_NAME;
  const timezone = r.timezone ?? DEFAULT_TIMEZONE;
  const transferPhone =
    r.transfer_phone ?? manifest.contact?.phone ?? "";

  if (!transferPhone) {
    throw new Error(
      "buildVapiSubstitutions: no transfer phone available (set receptionist.transfer_phone or contact.phone in the manifest)"
    );
  }

  return {
    assistant_display_name: `${receptionistName} — ${businessName}`,
    voice_provider: r.voice_provider ?? DEFAULT_VOICE_PROVIDER,
    voice_id: r.voice_id ?? DEFAULT_VOICE_ID,
    first_message: r.first_message ?? defaultFirstMessage(businessName),
    transfer_phone: transferPhone,
    transfer_message: r.transfer_message ?? DEFAULT_TRANSFER_MESSAGE,
    system_prompt: defaultSystemPrompt(receptionistName, businessName, timezone),
    analysis_summary_prompt: DEFAULT_ANALYSIS_PROMPT,
  };
}
