import { NextResponse, type NextRequest } from "next/server";
import { updateOrderStatus } from "@/lib/order-mutations";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["upcoming", "active", "completed", "cancelled"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    await updateOrderStatus(id, status as "upcoming" | "active" | "completed" | "cancelled");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[orders] PATCH failed:", message);
    return NextResponse.json({ error: "Could not update order" }, { status: 500 });
  }
}
