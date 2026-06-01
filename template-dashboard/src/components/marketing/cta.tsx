import Link from "next/link";

export default function Cta() {
  return (
    <section className="bg-gray-50/60 py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gray-900 px-8 py-14 text-center text-white md:px-14 md:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
            <div className="absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-brand-700/40 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Move your rentals onto TrackHQ.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-gray-300">
              Talk to us about your fleet. We'll show you the dashboard, walk through booking automation, and quote a setup that fits your scale.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/demo"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-6 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-100"
              >
                Book a demo →
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/30 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
