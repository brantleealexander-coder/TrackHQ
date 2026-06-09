import Image from "next/image";
import Link from "next/link";
import type { CustomerCompany } from "@/lib/registry";

export default function BookingHeader({ customer }: { customer: CustomerCompany }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href={`/book/${customer.slug}`} className="flex items-center gap-2.5">
          {customer.logo_url ? (
            <Image
              src={customer.logo_url}
              alt={customer.business_name}
              width={120}
              height={36}
              className="h-9 w-auto"
              unoptimized
            />
          ) : (
            <>
              <span
                aria-hidden
                className="inline-block h-7 w-7 rounded-md"
                style={{
                  background: `linear-gradient(to bottom right, ${customer.brand_color}, ${customer.brand_color}cc)`,
                }}
              />
              <span className="text-base font-semibold tracking-tight text-gray-900">
                {customer.business_name}
              </span>
            </>
          )}
        </Link>
        <p className="text-xs text-gray-400">
          Booking powered by <span className="font-medium text-gray-500">TrackHQ</span>
        </p>
      </div>
    </header>
  );
}
