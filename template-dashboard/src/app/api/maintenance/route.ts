import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { requireMembership } from "@/lib/auth";

export async function POST(request: Request) {
  const { company_id } = await requireMembership();

  const body = await request.json();
  const { equipment_id, date, cost, description, vendor, category, invoice_number } = body;

  if (!equipment_id || !date || !description) {
    return NextResponse.json(
      { error: "equipment_id, date, and description are required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("maintenance_logs")
    .insert({
      company_id,
      equipment_id: Number(equipment_id),
      date,
      cost: Number(cost) || 0,
      description: description.trim(),
      vendor: vendor?.trim() || null,
      category: category || null,
      invoice_number: invoice_number?.trim() || null,
      created_by: "admin",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
