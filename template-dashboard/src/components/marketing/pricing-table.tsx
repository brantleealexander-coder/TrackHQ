import Link from "next/link";

interface Tier {
  name: string;
  audience: string;
  price: string;
  priceUnit?: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}

const tiers: Tier[] = [
  {
    name: "Starter",
    audience: "Solo operators · up to 25 assets",
    price: "Contact",
    priceUnit: "for pricing",
    description: "Get on TrackHQ with the core dashboard and a hosted booking page. Perfect for a single yard or location.",
    features: [
      "Live inventory dashboard",
      "Hosted booking page (trackhq.tech/book/yours)",
      "Maintenance + rental history",
      "Standard email support",
      "One operator login",
    ],
    cta: { label: "Talk to sales", href: "/demo" },
  },
  {
    name: "Pro",
    audience: "Growing rental businesses · 25–200 assets",
    price: "Contact",
    priceUnit: "for pricing",
    description: "Everything in Starter plus the AI voice agent, GPS/telematics integrations, and QuickBooks sync.",
    features: [
      "Everything in Starter",
      "AI voice agent that books rentals",
      "GPS / Samsara / Cat VisionLink hookups",
      "QuickBooks two-way sync",
      "Multi-yard / multi-location",
      "Priority support",
    ],
    cta: { label: "Talk to sales", href: "/demo" },
    highlighted: true,
  },
  {
    name: "Enterprise",
    audience: "Large fleets · 200+ assets · multi-region",
    price: "Custom",
    description: "Dedicated infrastructure, custom integrations, and a deployment that fits how you actually run.",
    features: [
      "Everything in Pro",
      "Dedicated Supabase + isolated VAPI",
      "Custom domain (book.yourcompany.com)",
      "SSO + role-based access control",
      "Custom integrations + API access",
      "Direct line to the engineering team",
    ],
    cta: { label: "Talk to sales", href: "/demo" },
  },
];

export default function PricingTable() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Pricing</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Pricing that scales with your fleet.
          </h1>
          <p className="mt-4 text-base text-gray-600">
            We host every deployment under our infrastructure with monthly billing + a one-time setup fee. Talk to us about your fleet size and we&apos;ll quote a plan that fits.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={
                tier.highlighted
                  ? "relative rounded-3xl border-2 border-brand-500 bg-gradient-to-b from-white via-white to-brand-50/40 p-8 shadow-md"
                  : "relative rounded-3xl border border-gray-200 bg-white p-8 shadow-sm"
              }
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Most popular
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold text-gray-900">{tier.name}</h2>
                <p className="mt-1 text-xs text-gray-500">{tier.audience}</p>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight text-gray-900">{tier.price}</span>
                {tier.priceUnit && (
                  <span className="text-sm text-gray-500">{tier.priceUnit}</span>
                )}
              </div>

              <p className="mt-4 text-sm text-gray-600">{tier.description}</p>

              <ul className="mt-6 space-y-3 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-gray-700">
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.cta.href}
                className={
                  tier.highlighted
                    ? "mt-8 flex h-11 w-full items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                    : "mt-8 flex h-11 w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                }
              >
                {tier.cta.label} →
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-500">
          Final numbers TBD — we&apos;re finalizing pricing now and quoting per-customer until the table above goes live.
        </p>
      </div>
    </section>
  );
}
