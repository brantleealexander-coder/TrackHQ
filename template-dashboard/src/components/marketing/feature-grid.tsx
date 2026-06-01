interface Feature {
  title: string;
  body: string;
  icon: React.ReactNode;
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
      {children}
    </div>
  );
}

const features: Feature[] = [
  {
    title: "Live inventory",
    body:
      "Every asset in one place — status, location, customer, rate, maintenance history. Filter by category, status, location, or anything else.",
    icon: (
      <IconBox>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </IconBox>
    ),
  },
  {
    title: "Hosted booking page",
    body:
      "Drop a “Book Now” link on your website. Renters browse availability, pick dates, and submit bookings — all on a page branded as yours.",
    icon: (
      <IconBox>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </IconBox>
    ),
  },
  {
    title: "AI voice agent",
    body:
      "A receptionist that actually books rentals. It checks availability, quotes rates, and writes confirmed bookings straight into your inventory.",
    icon: (
      <IconBox>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </IconBox>
    ),
  },
  {
    title: "GPS + telematics",
    body:
      "Connect Cat VisionLink, Samsara, or anything else with a feed. See where every unit is right now on one map; flag late returns automatically.",
    icon: (
      <IconBox>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </IconBox>
    ),
  },
  {
    title: "Maintenance logs",
    body:
      "Every service, repair, and inspection on one timeline per unit. Tie costs back to revenue to see which assets are actually making you money.",
    icon: (
      <IconBox>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </IconBox>
    ),
  },
  {
    title: "QuickBooks-ready",
    body:
      "Two-way sync with your accounting. Invoices, payments, P&L — your bookkeeper sees the same numbers you do, without the spreadsheet hand-off.",
    icon: (
      <IconBox>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </IconBox>
    ),
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="bg-gray-50/60 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">What you get</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Everything a rental business needs, in one app.
          </h2>
          <p className="mt-4 text-base text-gray-600">
            We took the dashboard a real rental company has been running on for three years and turned it into a product anyone in the industry can use.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              {f.icon}
              <h3 className="mt-4 text-base font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
