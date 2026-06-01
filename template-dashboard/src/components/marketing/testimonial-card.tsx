export default function TestimonialCard() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6">
        <figure className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-brand-50/40 p-10 shadow-sm md:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-brand-500/15 to-transparent blur-3xl"
          />
          <svg
            aria-hidden
            className="h-8 w-8 text-brand-500"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9.5 7h-3a4.5 4.5 0 0 0-4.5 4.5V18h7v-7H6c0-2.21 1.79-4 4-4V5a6.5 6.5 0 0 0-6.5 6.5h6zM18 5v2c2.21 0 4 1.79 4 4h-3v7h7v-6.5A4.5 4.5 0 0 0 21.5 7H18z" />
          </svg>

          <blockquote className="mt-6 text-xl font-medium leading-relaxed tracking-tight text-gray-900 md:text-2xl">
            “We went from a wall of whiteboards and a half-dozen spreadsheets to one screen our whole team trusts. The map alone saved us a truck rolling out to a yard last week — we already knew the unit was on a job site.”
          </blockquote>

          <figcaption className="mt-8 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white">
              C
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Crossmar Rentals</p>
              <p className="text-xs text-gray-500">Heavy equipment rental · Texas + Arkansas</p>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
