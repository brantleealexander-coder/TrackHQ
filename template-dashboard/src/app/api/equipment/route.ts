import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Adding equipment includes setting daily / weekly / monthly rates —
// pricing decisions belong to Admin+. Members can still update status
// on existing equipment via the PATCH route.
export async function POST(request: Request) {
  const { company_id } = await requireRole(["owner", "admin"]);

  const body = await request.json();
  const {
    gl_code,
    serial_number,
    equipment_name,
    category_id,
    year,
    rate_daily,
    rate_weekly,
    rate_monthly,
    home_location_id,
    is_cross_charge,
  } = body;

  if (!gl_code || !equipment_name || !category_id) {
    return NextResponse.json(
      { error: "gl_code, equipment_name, and category_id are required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: eq, error: eqErr } = await supabase
    .from("equipment")
    .insert({
      company_id,
      gl_code: gl_code.trim().toUpperCase(),
      serial_number: serial_number?.trim()?.toUpperCase() || null,
      equipment_name: equipment_name.trim(),
      category_id: Number(category_id),
      year: year ? Number(year) : null,
      rate_daily: rate_daily ? Number(rate_daily) : null,
      rate_weekly: rate_weekly ? Number(rate_weekly) : null,
      rate_monthly: rate_monthly ? Number(rate_monthly) : null,
      home_location_id: home_location_id ? Number(home_location_id) : null,
      is_cross_charge: Boolean(is_cross_charge),
    })
    .select("id")
    .single();

  if (eqErr) {
    if (eqErr.code === "23505") {
      return NextResponse.json(
        { error: `GL code "${gl_code.trim().toUpperCase()}" already exists.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: eqErr.message }, { status: 500 });
  }

  const { data: availableStatus, error: lookupErr } = await supabase
    .from("statuses")
    .select("key")
    .eq("behavior", "available")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (lookupErr || !availableStatus) {
    return NextResponse.json(
      { error: "No status with behavior 'available' is configured. Seed the statuses table first." },
      { status: 500 }
    );
  }

  const { error: statusErr } = await supabase.from("equipment_status").insert({
    company_id,
    equipment_id: eq.id,
    status: availableStatus.key,
    updated_by: "admin",
  });

  if (statusErr) {
    return NextResponse.json({ error: statusErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: eq.id }, { status: 201 });
}
