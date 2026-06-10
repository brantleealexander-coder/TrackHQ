import { createServerSupabaseClient } from "./supabase";

export interface CallRow {
  id: number;
  vapi_call_id: string | null;
  caller_phone: string | null;
  caller_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
  outcome: string;
  recording_url: string | null;
  created_at: string;
}

export type TranscriptMessage = {
  role: string;
  message?: string;
  content?: string;
  time?: number;
  secondsFromStart?: number;
};

export interface CallDetail extends CallRow {
  transcript: TranscriptMessage[] | string | null;
}

export async function listCalls(
  companyId: number,
  limit = 50
): Promise<CallRow[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("call_logs")
    .select(
      "id, vapi_call_id, caller_phone, caller_name, started_at, ended_at, duration_seconds, summary, outcome, recording_url, created_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as CallRow[];
}

export async function getCall(
  companyId: number,
  id: number
): Promise<CallDetail | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("call_logs")
    .select(
      "id, vapi_call_id, caller_phone, caller_name, started_at, ended_at, duration_seconds, summary, outcome, recording_url, transcript, created_at"
    )
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as CallDetail;
}
