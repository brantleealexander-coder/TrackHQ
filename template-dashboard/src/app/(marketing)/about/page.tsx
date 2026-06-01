import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — TrackHQ",
  description: "TrackHQ was built from a real rental company's daily operations. Now we ship it as software for any rental business.",
};

export default function AboutPage() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">About</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
          Built from a real rental yard.
        </h1>

        <div className="mt-10 space-y-6 text-base leading-relaxed text-gray-700">
          <p>
            TrackHQ didn&apos;t start as software. It started as a heavy-equipment rental company called Crossmar trying to keep track of where their machines were, who had them out, what they owed, and which ones needed service this week.
          </p>
          <p>
            The first version was a whiteboard and a row of spreadsheets. The second was a homegrown dashboard. The third — three years of rough edges later — is what TrackHQ ships today: a single screen that knows every asset on the lot, every booking on the calendar, every dollar of rent active, and every truck rolling on a job site.
          </p>
          <p>
            We&apos;re packaging that up because it turns out most rental businesses have exactly the same problems. Whether you rent excavators, cargo vans, party tents, jet skis, or anything else with a daily rate — the operational shape is the same. So we built TrackHQ to be that one screen for any rental business, without you needing to hire a software team to make it work.
          </p>
          <p>
            We host every deployment under our own infrastructure. We onboard you. We tune the AI receptionist to your business. We&apos;re your software team, sized to the small fee you pay each month.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm font-semibold text-gray-900">Want the same setup running for your fleet?</p>
          <p className="mt-1 text-sm text-gray-600">
            Book a 20-minute demo. We&apos;ll show you the dashboard, the booking flow, and the voice agent — using a fleet that looks like yours.
          </p>
          <Link
            href="/demo"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-gray-900 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
          >
            Book a demo →
          </Link>
        </div>
      </div>
    </section>
  );
}
