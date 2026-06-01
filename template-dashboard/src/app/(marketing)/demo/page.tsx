import type { Metadata } from "next";
import ContactForm from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Book a demo — TrackHQ",
  description: "Book a 20-minute walkthrough of TrackHQ tailored to your fleet.",
};

export default function DemoPage() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Book a demo</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            See TrackHQ on your fleet.
          </h1>
          <p className="mt-4 text-base text-gray-600">
            20 minutes. We&apos;ll spin up a sandbox with a fleet that looks like yours, run through bookings + the voice agent, and quote a setup.
          </p>
        </div>

        <div className="mt-10">
          <ContactForm kind="demo" />
        </div>
      </div>
    </section>
  );
}
