import { Resend } from "resend";

/**
 * Brantlee gets the lead email at this address. Hardcoded because (a) it's
 * not secret, (b) we don't want it accidentally swapped to a customer's
 * inbox via env var — leads always go to TrackHQ ops.
 */
const LEAD_INBOX = "brantlee@talloakai.com";

interface LeadEmailPayload {
  kind: "demo" | "contact";
  name: string;
  email: string;
  phone?: string | null;
  business_name: string;
  rental_type?: string | null;
  current_software?: string | null;
  message?: string | null;
}

function fromAddress(): string {
  // Use the verified TrackHQ domain when set in env; otherwise fall back to
  // Resend's onboarding sender which works without DNS setup.
  return process.env.RESEND_FROM_ADDRESS ?? "TrackHQ <onboarding@resend.dev>";
}

function renderLeadHtml(p: LeadEmailPayload): string {
  const optional = (label: string, value?: string | null) =>
    value && value.trim().length > 0
      ? `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${label}</td><td style="padding:6px 0;color:#111827;font-size:14px;">${escape(value)}</td></tr>`
      : "";
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;max-width:560px;">
      <p style="font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin:0 0 6px 0;">
        New ${p.kind === "demo" ? "demo request" : "contact"}
      </p>
      <h1 style="margin:0 0 18px 0;font-size:22px;font-weight:700;">${escape(p.business_name)}</h1>
      <table style="border-collapse:collapse;width:100%;">
        <tbody>
          <tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Name</td><td style="padding:6px 0;font-size:14px;">${escape(p.name)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Email</td><td style="padding:6px 0;font-size:14px;"><a style="color:#F37535;text-decoration:none;" href="mailto:${escape(p.email)}">${escape(p.email)}</a></td></tr>
          ${optional("Phone", p.phone)}
          ${optional("Rents", p.rental_type)}
          ${optional("Current software", p.current_software)}
        </tbody>
      </table>
      ${
        p.message && p.message.trim().length > 0
          ? `<div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;"><p style="margin:0 0 6px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Message</p><p style="margin:0;font-size:14px;color:#111827;white-space:pre-wrap;">${escape(p.message)}</p></div>`
          : ""
      }
      <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Mark this lead's status in the super-admin inbox once you reach out.</p>
    </div>
  `;
}

function renderLeadText(p: LeadEmailPayload): string {
  const lines = [
    `New ${p.kind === "demo" ? "demo request" : "contact"} from ${p.business_name}`,
    ``,
    `Name:     ${p.name}`,
    `Email:    ${p.email}`,
  ];
  if (p.phone) lines.push(`Phone:    ${p.phone}`);
  if (p.rental_type) lines.push(`Rents:    ${p.rental_type}`);
  if (p.current_software) lines.push(`Software: ${p.current_software}`);
  if (p.message) {
    lines.push(``, `Message:`, p.message);
  }
  return lines.join("\n");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendLeadNotification(payload: LeadEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No Resend configured — log so the operator can still see the lead in
    // Vercel function logs until they wire up an API key.
    console.warn("[email] RESEND_API_KEY not set; lead-notification skipped:", JSON.stringify(payload));
    return;
  }
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: fromAddress(),
    to: LEAD_INBOX,
    replyTo: payload.email,
    subject: `New TrackHQ lead — ${payload.business_name}`,
    html: renderLeadHtml(payload),
    text: renderLeadText(payload),
  });
}
