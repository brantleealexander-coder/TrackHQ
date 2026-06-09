import { NextResponse, type NextRequest } from "next/server";
import { searchCustomers } from "@/lib/customer-queries";
import { createCustomer } from "@/lib/customer-mutations";
import { requireMembership, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const { company_id } = await requireMembership();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "8", 10) || 8);
  const results = await searchCustomers(company_id, q, limit);
  return NextResponse.json({ customers: results });
}

interface InboundCustomer {
  name: unknown;
  email: unknown;
  phone: unknown;
  company: unknown;
  address: unknown;
}

// Creating customer records — and the contact / billing info that goes with
// them — is restricted to Admin+. Members can still SELECT existing
// customers from the order picker; if a new prospect needs to be added,
// they ask an admin or have the front-office add the row.
export async function POST(req: NextRequest) {
  const { company_id } = await requireRole(["owner", "admin"]);
  let body: InboundCustomer;
  try {
    body = (await req.json()) as InboundCustomer;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const id = await createCustomer(company_id, {
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      address: address || null,
    });
    return NextResponse.json({ ok: true, customer_id: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[customers] create failed:", message);
    return NextResponse.json({ error: "Could not create customer" }, { status: 500 });
  }
}
