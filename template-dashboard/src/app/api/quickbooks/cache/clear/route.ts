import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function DELETE() {
  const supabase = createServerSupabaseClient();
  await supabase.from("qb_cache").delete().neq("cache_key", "");
  return NextResponse.json({ ok: true });
}
