import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <Link href="/" className="mb-12 inline-flex items-center gap-3">
        <Image
          src="/trackhq-logo.svg"
          alt="TrackHQ"
          width={40}
          height={40}
          priority
        />
        <span className="text-xl font-semibold text-gray-900">TrackHQ</span>
      </Link>

      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
        404
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-base text-gray-600">
        The link you followed may be broken, or the page may have been moved.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          Back to home
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          Contact us
        </Link>
      </div>
    </main>
  );
}
