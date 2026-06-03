import { NextResponse, type NextRequest } from "next/server";
import { getCustomer, createCustomerClient } from "@/lib/registry";
import { insertBookingRequest } from "@/lib/booking-queries";
import { upsertCustomer } from "@/lib/customer-mutations";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_RATE_TYPES = new Set(["daily", "weekly", "monthly"]);

interface BookingPayload {
  equipment_id: unknown;
  renter_name: unknown;
  renter_email: unknown;
  renter_phone: unknown;
  rental_start: unknown;
  rental_end: unknown;
  rate_type: unknown;
  notes: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  let payload: BookingPayload;
  try {
    payload = (await req.json()) as BookingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const equipment_id = typeof payload.equipment_id === "number" ? payload.equipment_id : null;
  const renter_name = typeof payload.renter_name === "string" ? payload.renter_name.trim() : "";
  const renter_email = typeof payload.renter_email === "string" ? payload.renter_email.trim() : "";
  const renter_phone = typeof payload.renter_phone === "string" ? payload.renter_phone.trim() : null;
  const rental_start = typeof payload.rental_start === "string" ? payload.rental_start : "";
  const rental_end = typeof payload.rental_end === "string" ? payload.rental_end : "";
  const rate_type_raw = typeof payload.rate_type === "string" ? payload.rate_type : null;
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : null;

  if (!equipment_id || equipment_id <= 0) {
    return NextResponse.json({ error: "equipment_id is required" }, { status: 400 });
  }
  if (!renter_name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(renter_email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!ISO_DATE_RE.test(rental_start) || !ISO_DATE_RE.test(rental_end)) {
    return NextResponse.json({ error: "rental_start and rental_end must be YYYY-MM-DD" }, { status: 400 });
  }
  if (rental_end <= rental_start) {
    return NextResponse.json({ error: "rental_end must be after rental_start" }, { status: 400 });
  }
  const rate_type =
    rate_type_raw && VALID_RATE_TYPES.has(rate_type_raw)
      ? (rate_type_raw as "daily" | "weekly" | "monthly")
      : null;

  const customer = await getCustomer(params.slug);
  if (!customer) {
    return NextResponse.json({ error: "Unknown customer" }, { status: 404 });
  }

  const client = createCustomerClient(customer);

  try {
    // Dedupe-or-create the customer in the fork's CRM before writing the
    // booking_request. If the CRM table is missing on a pre-6 fork this
    // throws — swallow it so the booking request still goes through.
    let customer_id: number | null = null;
    try {
      const upserted = await upsertCustomer(
        {
          name: renter_name,
          email: renter_email,
          phone: renter_phone || null,
        },
        client
      );
      customer_id = upserted.id;
    } catch (crmErr) {
      const m = crmErr instanceof Error ? crmErr.message : String(crmErr);
      console.warn("[book] customer auto-create skipped:", m);
    }

    const result = await insertBookingRequest(client, {
      equipment_id,
      renter_name,
      renter_email,
      renter_phone: renter_phone || null,
      rental_start,
      rental_end,
      rate_type,
      notes,
      source: "web",
      customer_id,
    });
    return NextResponse.json({ ok: true, booking_id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[book] insert failed:", message);
    return NextResponse.json({ error: "Could not save booking" }, { status: 500 });
  }
}
