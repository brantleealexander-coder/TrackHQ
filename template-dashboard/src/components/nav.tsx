"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getTenantConfig } from "@/lib/tenant-config";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase";

interface NavLink {
  href: string;
  label: string;
  feature?: "samsara" | "visionlink" | "quickbooks";
  icon: React.ReactNode;
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 flex-shrink-0"
    >
      {children}
    </svg>
  );
}

const MAIN_LINKS: NavLink[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: <Icon><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Icon>,
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: <Icon><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="3" x2="8" y2="5" /><line x1="16" y1="3" x2="16" y2="5" /></Icon>,
  },
  {
    href: "/app/orders",
    label: "Orders",
    icon: <Icon><path d="M6 2l1.5 3h9L18 2" /><rect x="4" y="5" width="16" height="17" rx="1.5" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="16" y2="15" /><line x1="8" y1="19" x2="13" y2="19" /></Icon>,
  },
  {
    href: "/app/customers",
    label: "Customers",
    icon: <Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9.5" r="2.5" /><path d="M21.5 18a4.5 4.5 0 0 0-5.5-4.4" /></Icon>,
  },
  {
    href: "/app/documents",
    label: "Documents",
    icon: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></Icon>,
  },
];

function operationsLinks(assetPlural: string): NavLink[] {
  return [
    {
      href: "/app/fleet",
      label: assetPlural,
      icon: <Icon><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>,
    },
    {
      href: "/app/financials",
      label: "Financials",
      icon: <Icon><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></Icon>,
    },
    {
      href: "/app/accounting",
      label: "Accounting",
      feature: "quickbooks",
      icon: <Icon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>,
    },
    {
      href: "/app/map",
      label: "Map",
      icon: <Icon><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></Icon>,
    },
    {
      href: "/app/telematics",
      label: "Telematics",
      feature: "visionlink",
      icon: <Icon><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Icon>,
    },
    {
      href: "/app/samsara",
      label: "Samsara Devices",
      feature: "samsara",
      icon: <Icon><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Icon>,
    },
    {
      href: "/app/maintenance",
      label: "Log Maintenance",
      icon: <Icon><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></Icon>,
    },
    {
      href: "/app/admin",
      label: "Update Status",
      icon: <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>,
    },
  ];
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { business, features, terminology } = getTenantConfig();

  const operations = operationsLinks(terminology.asset_plural).filter(
    (l) => !l.feature || features[l.feature]
  );

  async function handleLogout() {
    const supabase = createSupabaseBrowserAuthClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="px-5 pt-5 pb-3">
        {business.logo_url ? (
          <Image
            src={business.logo_url}
            alt={business.name}
            width={160}
            height={39}
            className="h-9 w-auto"
            unoptimized
            priority
          />
        ) : (
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-7 w-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700"
            />
            <p className="text-sm font-semibold tracking-tight text-gray-900">
              {business.name}
            </p>
          </div>
        )}
      </div>

      {/* New Order CTA */}
      <div className="px-3 pb-3">
        <Link
          href="/app/orders/new"
          className="group flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:from-brand-600 hover:to-brand-700 active:translate-y-[0.5px]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Order
        </Link>
      </div>

      {/* MAIN section */}
      <NavSection label="Main" links={MAIN_LINKS} pathname={pathname} />

      <div className="my-2 mx-3 border-t border-gray-100" />

      {/* OPERATIONS section */}
      <NavSection label="Operations" links={operations} pathname={pathname} />

      <div className="flex-1" />

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <Icon>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </Icon>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavSection({
  label,
  links,
  pathname,
}: {
  label: string;
  links: NavLink[];
  pathname: string;
}) {
  return (
    <div>
      <p className="px-5 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <nav className="px-3">
        <ul className="space-y-0.5">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")
                  }
                >
                  <span className={active ? "text-brand-600" : "text-gray-400"}>
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
