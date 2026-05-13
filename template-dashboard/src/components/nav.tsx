"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/fleet", label: "Fleet Status" },
  { href: "/financials", label: "Financials" },
  { href: "/accounting", label: "Accounting" },
  { href: "/map", label: "Fleet Map" },
  { href: "/telematics", label: "Telematics" },
  { href: "/samsara", label: "Samsara Devices" },
  { href: "/maintenance", label: "Log Maintenance" },
  { href: "/admin", label: "Update Status" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-zinc-950 text-white min-h-screen">
      <div className="px-5 py-5 border-b border-zinc-800">
        <Image
          src="https://www.crossmarequip.com/image/site_logo/crossmar_final1.jpg"
          alt="CrossMar Equipment Rental"
          width={160}
          height={60}
          className="rounded"
          unoptimized
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mt-3">
          Fleet Dashboard
        </p>
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
                  ? "bg-orange-500 text-white"
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
