"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getTenantConfig } from "@/lib/tenant-config";

const allLinks: { href: string; label: string; feature?: "samsara" | "visionlink" | "quickbooks" }[] = [
  { href: "/app/fleet", label: "Fleet Status" },
  { href: "/app/financials", label: "Financials" },
  { href: "/app/accounting", label: "Accounting", feature: "quickbooks" },
  { href: "/app/map", label: "Fleet Map" },
  { href: "/app/telematics", label: "Telematics", feature: "visionlink" },
  { href: "/app/samsara", label: "Samsara Devices", feature: "samsara" },
  { href: "/app/maintenance", label: "Log Maintenance" },
  { href: "/app/admin", label: "Update Status" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { business, features } = getTenantConfig();

  const links = allLinks.filter((l) => !l.feature || features[l.feature]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-zinc-950 text-white min-h-screen">
      <div className="px-5 py-5 border-b border-zinc-800">
        {business.logo_url ? (
          <Image
            src={business.logo_url}
            alt={business.name}
            width={160}
            height={60}
            className="rounded"
            unoptimized
          />
        ) : (
          <p className="text-lg font-bold text-white">{business.name}</p>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-500 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </nav>
    </aside>
  );
}
