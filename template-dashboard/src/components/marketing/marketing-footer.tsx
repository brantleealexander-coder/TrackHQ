import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
              <span aria-hidden className="inline-block h-6 w-6 rounded bg-gradient-to-br from-brand-500 to-brand-700" />
              TrackHQ
            </Link>
            <p className="mt-3 max-w-xs text-sm text-gray-500">
              Asset rental software for fleets, vehicles, watercraft, and event-rental businesses.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/#features" className="text-gray-600 hover:text-gray-900">Features</Link></li>
              <li><Link href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link></li>
              <li><Link href="/demo" className="text-gray-600 hover:text-gray-900">Book a demo</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Company</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/about" className="text-gray-600 hover:text-gray-900">About</Link></li>
              <li><Link href="/contact" className="text-gray-600 hover:text-gray-900">Contact</Link></li>
              <li><Link href="/privacy" className="text-gray-600 hover:text-gray-900">Privacy</Link></li>
              <li><Link href="/terms" className="text-gray-600 hover:text-gray-900">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-gray-100 pt-6 text-sm text-gray-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} TrackHQ. All rights reserved.</p>
          <p className="text-xs text-gray-400">Built for rental businesses.</p>
        </div>
      </div>
    </footer>
  );
}
