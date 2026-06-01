import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient + grain */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-brand-500/10 via-brand-500/5 to-transparent" />
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 h-[500px] w-[800px] -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-500/20 via-brand-300/10 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Rental management, reimagined
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Run your rental business
            <span className="block bg-gradient-to-r from-brand-700 via-brand-500 to-brand-400 bg-clip-text text-transparent">
              from one place.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-gray-600 sm:text-lg">
            Inventory, bookings, GPS tracking, maintenance, and an AI voice agent that takes rentals over the phone. Built for any business that rents things out — heavy equipment, vehicles, watercraft, event gear.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-gray-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              Book a demo →
            </Link>
            <Link
              href="/#features"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              See features
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            No credit card required. Talk to us first — we tailor TrackHQ to your fleet.
          </p>
        </div>
      </div>
    </section>
  );
}
