import Link from "next/link";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export default function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900"
        >
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded bg-gradient-to-br from-brand-500 to-brand-700"
          />
          TrackHQ
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 sm:inline-block"
          >
            Sign in
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-9 items-center rounded-lg bg-gray-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </header>
  );
}
