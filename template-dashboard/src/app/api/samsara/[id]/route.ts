import { NextRequest, NextResponse } from "next/server";
import { updateSamsaraDevice } from "@/lib/samsara-queries";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { company_id } = await requireMembership();
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: {
    notes?: string | null;
    equipment_id?: number | null;
    is_active?: boolean;
    gateway_serial?: string | null;
    samsara_name?: string | null;
  } = {};

  if ("notes" in body) patch.notes = body.notes ?? null;
  if ("equipment_id" in body) {
    const eid = body.equipment_id;
    patch.equipment_id = eid === null || eid === "" ? null : Number(eid);
  }
  if ("is_active" in body) patch.is_active = Boolean(body.is_active);
  if ("gateway_serial" in body) {
    const gs = typeof body.gateway_serial === "string" ? body.gateway_serial.trim() : null;
    patch.gateway_serial = gs && gs.length > 0 ? gs : null;
  }
  if ("samsara_name" in body) {
    const sn = typeof body.samsara_name === "string" ? body.samsara_name.trim() : null;
    patch.samsara_name = sn && sn.length > 0 ? sn : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    await updateSamsaraDevice(company_id, id, patch);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
