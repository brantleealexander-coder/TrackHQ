import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { calcRevenue } from "@/lib/financials";
import { requireMembership, requireRole } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { company_id } = await requireMembership();
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

  const supabase = createServerSupabaseClient();

  const [currentRes, eqRes, statusesRes] = await Promise.all([
    supabase
      .from("equipment_status")
      .select("status, rate_type, rental_start, rental_end, customer_name, job_po_notes")
      .eq("company_id", company_id)
      .eq("equipment_id", equipmentId)
      .maybeSingle(),
    supabase
      .from("equipment")
      .select("rate_daily, rate_weekly, rate_monthly")
      .eq("company_id", company_id)
      .eq("id", equipmentId)
      .single(),
    supabase.from("statuses").select("key, behavior"),
  ]);

  if (currentRes.error) {
    return NextResponse.json({ error: currentRes.error.message }, { status: 500 });
  }
  if (eqRes.error) {
    return NextResponse.json({ error: eqRes.error.message }, { status: 500 });
  }
  if (statusesRes.error) {
    return NextResponse.json({ error: statusesRes.error.message }, { status: 500 });
  }

  const current = currentRes.data;
  const eq = eqRes.data;
  const behaviorByKey = new Map<string, string>(
    (statusesRes.data ?? []).map((s) => [s.key, s.behavior])
  );
  const previousBehavior = behaviorByKey.get(current?.status ?? "");
  const newBehavior = behaviorByKey.get(status);

  let revenue_amount: number | null = null;
  const wasRented = previousBehavior === "rented";
  const closingRental =
    wasRented &&
    newBehavior !== "rented" &&
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
    .eq("company_id", company_id)
    .eq("equipment_id", equipmentId);

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  if (location) {
    try {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (mapboxToken) {
        const geoRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxToken}&limit=1`
        );
        const geoData = await geoRes.json();
        const coords = geoData?.features?.[0]?.center;
        if (coords) {
          await supabase
            .from("equipment")
            .update({
              current_address: location,
              current_lat: coords[1],
              current_lng: coords[0],
            })
            .eq("company_id", company_id)
            .eq("id", equipmentId);
        }
      }
    } catch {
      // Geocoding failure is non-fatal
    }
  } else if (newBehavior === "available" || newBehavior === "out_of_service") {
    await supabase
      .from("equipment")
      .update({
        current_address: null,
        current_lat: null,
        current_lng: null,
      })
      .eq("company_id", company_id)
      .eq("id", equipmentId);
  }

  const { error: histErr } = await supabase.from("rental_history").insert({
    company_id,
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

// Removing equipment is destructive and affects financial history —
// Admin+ only. PATCH (status updates, customer/job tags) stays open to
// Members because that's day-to-day yard operations.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { company_id } = await requireRole(["owner", "admin"]);
  const equipmentId = parseInt(params.id, 10);
  if (isNaN(equipmentId)) {
    return NextResponse.json({ error: "Invalid equipment id" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: eq } = await supabase
    .from("equipment")
    .select("gl_code, equipment_name")
    .eq("company_id", company_id)
    .eq("id", equipmentId)
    .single();

  const { error } = await supabase
    .from("equipment")
    .delete()
    .eq("company_id", company_id)
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
