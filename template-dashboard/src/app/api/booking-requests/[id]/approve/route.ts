import { NextResponse, type NextRequest } from "next/server";
import { requireMembership } from "@/lib/auth";
import { approveBookingRequest } from "@/lib/booking-request-mutations";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { company_id } = await requireMembership();
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  try {
    const result = await approveBookingRequest(company_id, id);
    return NextResponse.json({ ok: true, order_id: result.order_id, total: result.total });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[booking-requests/approve] failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
