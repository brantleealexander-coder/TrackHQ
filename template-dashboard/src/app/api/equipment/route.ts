import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const key =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function POST(request: Request) {
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

  const supabase = getSupabase();

  // 1. Insert equipment row
  const { data: eq, error: eqErr } = await supabase
    .from("equipment")
    .insert({
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
    // Duplicate GL code gives a unique constraint error
    if (eqErr.code === "23505") {
      return NextResponse.json(
        { error: `GL code "${gl_code.trim().toUpperCase()}" already exists.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: eqErr.message }, { status: 500 });
  }

  // 2. Insert initial equipment_status row using the tenant's first status
  //    whose behavior is 'available'. Tenants that haven't seeded statuses
  //    yet will get a clear error.
  const { data: availableStatus, error: lookupErr } = await supabase
    .from("statuses")
    .select("key")
    .eq("behavior", "available")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (lookupErr || !availableStatus) {
    return NextResponse.json(
      { error: "No status with behavior 'available' is configured for this tenant. Seed the statuses table first." },
      { status: 500 }
    );
  }

  const { error: statusErr } = await supabase.from("equipment_status").insert({
    equipment_id: eq.id,
    status: availableStatus.key,
    updated_by: "admin",
  });

  if (statusErr) {
    return NextResponse.json({ error: statusErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: eq.id }, { status: 201 });
}
