import { NextResponse, type NextRequest } from "next/server";
import { createOrder } from "@/lib/order-mutations";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_RATE = new Set(["daily", "weekly", "monthly"]);
const VALID_STATUS = new Set(["upcoming", "active"]);

interface InboundLine {
  equipment_id: unknown;
  rate_type: unknown;
  rate_amount: unknown;
  line_total: unknown;
}
interface InboundOrder {
  customer_id: unknown;
  rental_start: unknown;
  rental_end: unknown;
  notes: unknown;
  status: unknown;
  lines: unknown;
}

export async function POST(req: NextRequest) {
  const { company_id } = await requireMembership();

  let payload: InboundOrder;
  try {
    payload = (await req.json()) as InboundOrder;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const customer_id = typeof payload.customer_id === "number" ? payload.customer_id : null;
  const rental_start = typeof payload.rental_start === "string" ? payload.rental_start : "";
  const rental_end = typeof payload.rental_end === "string" ? payload.rental_end : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : null;
  const statusRaw = typeof payload.status === "string" ? payload.status : "upcoming";
  const status = (VALID_STATUS.has(statusRaw) ? statusRaw : "upcoming") as "upcoming" | "active";

  if (!customer_id || customer_id <= 0) {
    return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  }
  if (!ISO_DATE.test(rental_start) || !ISO_DATE.test(rental_end)) {
    return NextResponse.json({ error: "rental_start and rental_end must be YYYY-MM-DD" }, { status: 400 });
  }
  if (rental_end < rental_start) {
    return NextResponse.json({ error: "rental_end must be on or after rental_start" }, { status: 400 });
  }

  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
  }

  const lines = [];
  for (const raw of payload.lines as InboundLine[]) {
    const equipment_id = typeof raw.equipment_id === "number" ? raw.equipment_id : 0;
    const rate_type_raw = typeof raw.rate_type === "string" ? raw.rate_type : "";
    const rate_amount = typeof raw.rate_amount === "number" ? raw.rate_amount : 0;
    const line_total = typeof raw.line_total === "number" ? raw.line_total : 0;
    if (!equipment_id || !VALID_RATE.has(rate_type_raw) || rate_amount <= 0 || line_total <= 0) {
      return NextResponse.json({ error: "Invalid line item" }, { status: 400 });
    }
    lines.push({
      equipment_id,
      rate_type: rate_type_raw as "daily" | "weekly" | "monthly",
      rate_amount,
      line_total,
    });
  }

  try {
    const created = await createOrder(company_id, {
      customer_id,
      rental_start,
      rental_end,
      notes: notes || null,
      source: "operator",
      status,
      lines,
    });
    return NextResponse.json({ ok: true, order_id: created.id, total: created.total });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[orders] create failed:", message);
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }
}
