import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCall, type TranscriptMessage } from "@/lib/call-queries";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

function fmtFullTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDuration(secs: number | null): string {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

function outcomeBadge(outcome: string): string {
  if (outcome === "booking") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (outcome === "quote") return "bg-brand-50 text-brand-700 ring-brand-200";
  if (outcome === "message") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-gray-100 text-gray-600 ring-gray-200";
}

function normalizeTranscript(t: TranscriptMessage[] | string | null): TranscriptMessage[] {
  if (!t) return [];
  if (typeof t === "string") {
    // Older plain-text transcripts — return as a single block.
    return [{ role: "transcript", message: t }];
  }
  return t.filter((m) => m && (m.message || m.content));
}

export default async function CallDetailPage({
  params,
}: {
  params: { id: string };
}) {
  noStore();
  const { company_id } = await requireMembership();
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) notFound();

  const call = await getCall(company_id, id);
  if (!call) notFound();

  const transcript = normalizeTranscript(call.transcript);

  return (
    <div className="space-y-8">
      <Link
        href="/app/calls"
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
      >
        ← Back to calls
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {call.caller_name ?? "Unknown caller"}
          </h1>
          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${outcomeBadge(call.outcome)}`}>
            {call.outcome}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {fmtFullTime(call.started_at ?? call.created_at)} · {fmtDuration(call.duration_seconds)}
          {call.caller_phone && ` · ${call.caller_phone}`}
        </p>
      </div>

      {/* Summary */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Summary</h2>
        {call.summary ? (
          <p className="whitespace-pre-wrap text-sm text-gray-700">{call.summary}</p>
        ) : (
          <p className="text-sm text-gray-400">No summary generated for this call.</p>
        )}
      </section>

      {/* Recording */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recording</h2>
          {call.recording_url && (
            <a
              href={call.recording_url}
              download
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Download
            </a>
          )}
        </div>
        {call.recording_url ? (
          <audio controls src={call.recording_url} className="w-full" preload="metadata">
            Your browser doesn&apos;t support audio playback.
          </audio>
        ) : (
          <p className="text-sm text-gray-400">No recording available for this call.</p>
        )}
      </section>

      {/* Transcript */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Transcript</h2>
        {transcript.length === 0 ? (
          <p className="text-sm text-gray-400">No transcript available for this call.</p>
        ) : (
          <ul className="space-y-3">
            {transcript.map((m, i) => {
              const isAssistant = m.role === "assistant" || m.role === "bot";
              const text = m.message ?? m.content ?? "";
              return (
                <li key={i} className={isAssistant ? "flex" : "flex justify-end"}>
                  <div
                    className={
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm " +
                      (isAssistant
                        ? "bg-brand-50 text-gray-900"
                        : "bg-gray-100 text-gray-900")
                    }
                  >
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {isAssistant ? "Assistant" : m.role === "system" ? "System" : "Caller"}
                    </p>
                    <p className="whitespace-pre-wrap">{text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
