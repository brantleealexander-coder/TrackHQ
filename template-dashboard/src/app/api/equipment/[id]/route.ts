import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcRevenue } from "@/lib/financials";

// Use service-role key if available (for server-side writes), fall back to anon key.
// On Vercel: add SUPABASE_SERVICE_KEY only if you want to skip RLS. Since RLS is disabled
// on these tables, the anon key works fine.
function getSupabase() {
  const key =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const equipmentId = parseInt(params.id, 10);
  if (isNaN(equipmentId)) {
    return NextResponse.json({ error: "Invalid equipment id" }, { status: 400 });
  }

  const body = await request.json();
  const {
    status,
    customer_name,
    job_po_notes,
    rate_type,
    rental_start,
    rental_end,
    location,
    updated_by = "admin",
  } = body;

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // 1. Fetch current equipment_status + equipment rates
  const { data: current, error: fetchErr } = await supabase
    .from("equipment_status")
    .select(
      "status, rate_type, rental_start, rental_end, customer_name, job_po_notes"
    )
    .eq("equipment_id", equipmentId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const { data: eq, error: eqErr } = await supabase
    .from("equipment")
    .select("rate_daily, rate_weekly, rate_monthly")
    .eq("id", equipmentId)
    .single();

  if (eqErr) {
    return NextResponse.json({ error: eqErr.message }, { status: 500 });
  }

  // 2. Compute revenue if we're closing a rental
  let revenue_amount: number | null = null;
  const wasOnRent = current?.status === "ON RENT";
  const closingRental =
    wasOnRent &&
    status !== "ON RENT" &&
    current?.rental_start;

  if (closingRental) {
    const start = new Date(current!.rental_start!);
    const end = rental_end
      ? new Date(rental_end)
      : new Date();
    const rt = rate_type ?? current?.rate_type;
    if (rt && eq) {
      revenue_amount = calcRevenue(
        rt,
        eq.rate_daily ?? 0,
        eq.rate_weekly ?? 0,
        eq.rate_monthly ?? 0,
        start,
        end
      );
    }
  }

  // 3. Update equipment_status (seed script guarantees one row per equipment)
  const { error: upsertErr } = await supabase
    .from("equipment_status")
    .update({
      status,
      customer_name: customer_name ?? null,
      job_po_notes: job_po_notes ?? null,
      rate_type: rate_type ?? null,
      rental_start: rental_start ?? null,
      rental_end: rental_end ?? null,
      updated_at: new Date().toISOString(),
      updated_by,
    })
    .eq("equipment_id", equipmentId);

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // 4. Geocode location and update equipment if address provided
  if (location) {
    try {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (mapboxToken) {
        const geoRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxToken}&limit=1`
        );
        const geoData = await geoRes.json();
        const coords = geoData?.features?.[0]?.center; // [lng, lat]
        if (coords) {
          await supabase
            .from("equipment")
            .update({
              current_address: location,
              current_lat: coords[1],
              current_lng: coords[0],
            })
            .eq("id", equipmentId);
        }
      }
    } catch {
      // Geocoding failure is non-fatal — location just won't update on map
    }
  } else if (status === "AVAILABLE" || status === "IN SERVICE") {
    // Clear location when equipment returns to yard
    await supabase
      .from("equipment")
      .update({
        current_address: null,
        current_lat: null,
        current_lng: null,
      })
      .eq("id", equipmentId);
  }

  // 5. Append rental_history row
  const { error: histErr } = await supabase.from("rental_history").insert({
    equipment_id: equipmentId,
    status_before: current?.status ?? null,
    status_after: status,
    customer_name: customer_name ?? null,
    job_po_notes: job_po_notes ?? null,
    rate_type: rate_type ?? null,
    rental_start: rental_start ?? null,
    rental_end: rental_end ?? null,
    revenue_amount,
    recorded_by: updated_by,
  });

  if (histErr) {
    return NextResponse.json({ error: histErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revenue_amount });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const equipmentId = parseInt(params.id, 10);
  if (isNaN(equipmentId)) {
    return NextResponse.json({ error: "Invalid equipment id" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Fetch name for confirmation message before deleting
  const { data: eq } = await supabase
    .from("equipment")
    .select("gl_code, equipment_name")
    .eq("id", equipmentId)
    .single();

  const { error } = await supabase
    .from("equipment")
    .delete()
    .eq("id", equipmentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    gl_code: eq?.gl_code,
    equipment_name: eq?.equipment_name,
  });
}
