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

interface BookingConfirmationPayload {
  to: string;
  business_name: string;
  customer_name: string;
  asset_name: string;
  rental_start: string;
  rental_end: string;
  total: number;
  ref_number: string;
  contact_phone?: string;
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function renderConfirmationHtml(p: BookingConfirmationPayload): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;max-width:560px;">
      <p style="font-size:13px;color:#F37535;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0 0 8px 0;">Confirmed</p>
      <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#111827;">Your booking is set, ${escape(p.customer_name)}.</h1>
      <p style="margin:0 0 22px 0;font-size:15px;color:#4b5563;">Thanks for choosing ${escape(p.business_name)}. Here are the details:</p>
      <table style="border-collapse:collapse;width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tbody>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;width:140px;">Asset</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#111827;">${escape(p.asset_name)}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Start</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${escape(fmtDate(p.rental_start))}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">End</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${escape(fmtDate(p.rental_end))}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Reference</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-family:ui-monospace,monospace;font-size:14px;color:#111827;">${escape(p.ref_number)}</td></tr>
          <tr><td style="padding:14px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Total</td><td style="padding:14px 16px;font-size:18px;font-weight:700;color:#111827;">${fmtMoney(p.total)}</td></tr>
        </tbody>
      </table>
      <p style="margin:24px 0 8px 0;font-size:14px;color:#4b5563;">
        ${p.contact_phone ? `Questions? Call us at <a style="color:#F37535;text-decoration:none;font-weight:600;" href="tel:${escape(p.contact_phone)}">${escape(p.contact_phone)}</a>.` : "Reply to this email if anything looks off."}
      </p>
      <p style="margin:0;font-size:14px;color:#4b5563;">See you soon.</p>
      <p style="margin-top:18px;font-size:14px;color:#111827;font-weight:600;">${escape(p.business_name)}</p>
    </div>
  `;
}

function renderConfirmationText(p: BookingConfirmationPayload): string {
  const lines = [
    `Your booking is set, ${p.customer_name}.`,
    ``,
    `Thanks for choosing ${p.business_name}. Here are the details:`,
    ``,
    `Asset:     ${p.asset_name}`,
    `Start:     ${fmtDate(p.rental_start)}`,
    `End:       ${fmtDate(p.rental_end)}`,
    `Reference: ${p.ref_number}`,
    `Total:     ${fmtMoney(p.total)}`,
    ``,
  ];
  if (p.contact_phone) lines.push(`Questions? Call us at ${p.contact_phone}.`);
  else lines.push(`Reply to this email if anything looks off.`);
  lines.push(``, `See you soon.`, p.business_name);
  return lines.join("\n");
}

export async function sendBookingConfirmation(payload: BookingConfirmationPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY not set; booking-confirmation skipped:",
      JSON.stringify({ to: payload.to, ref: payload.ref_number })
    );
    return;
  }
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: fromAddress(),
    to: payload.to,
    subject: `Your ${payload.business_name} booking is confirmed`,
    html: renderConfirmationHtml(payload),
    text: renderConfirmationText(payload),
  });
}
