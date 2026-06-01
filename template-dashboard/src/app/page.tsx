/**
 * Phase 5a placeholder — the real marketing landing lands in 5b.
 *
 * This page is intentionally minimal. Its existence frees up `/` from
 * the previous `redirect("/fleet")` so the route is ready for the
 * marketing site. Operators going to `/app/fleet` directly still work.
 */

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700 mb-3">
          TrackHQ
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Sales-ready landing page is in flight.
        </h1>
        <p className="text-gray-600 mb-8">
          Phase 5a moved the operator dashboard under{" "}
          <code className="px-1.5 py-0.5 bg-gray-200 rounded text-sm">/app</code>{" "}
          and freed up this route for the marketing site that lands in Phase 5b.
        </p>
        <Link
          href="/app/fleet"
          className="inline-block px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
        >
          Open the dashboard →
        </Link>
      </div>
    </main>
  );
}
