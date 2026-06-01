import type { Metadata } from "next";
import ContactForm from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact — TrackHQ",
  description: "Get in touch with the TrackHQ team.",
};

export default function ContactPage() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Contact</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Get in touch.
          </h1>
          <p className="mt-4 text-base text-gray-600">
            Questions about TrackHQ, an existing deployment, or a partnership? Drop us a note and we&apos;ll get back within one business day.
          </p>
        </div>

        <div className="mt-10">
          <ContactForm kind="contact" />
        </div>
      </div>
    </section>
  );
}
