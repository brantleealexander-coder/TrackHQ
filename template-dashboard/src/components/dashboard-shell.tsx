"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Nav from "@/components/nav";

interface DashboardShellProps {
  children: React.ReactNode;
  pendingCount?: number;
}

export default function DashboardShell({ children, pendingCount = 0 }: DashboardShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="dashboard-sidebar"
          className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-700 transition-colors hover:bg-gray-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Image
          src="/trackhq-logo.svg"
          alt="TrackHQ"
          width={120}
          height={28}
          priority
          unoptimized
          className="h-7 w-auto"
        />
        <span className="w-10" aria-hidden />
      </div>

      {/* Backdrop (mobile only, while open) */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
          aria-hidden
        />
      )}

      {/* Sidebar — static on desktop, fixed slide-in drawer on mobile */}
      <div
        id="dashboard-sidebar"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Main navigation"
        className={
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out " +
          "lg:static lg:z-auto lg:translate-x-0 lg:transition-none " +
          (open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
        }
      >
        {/* Mobile drawer close button overlaid on Nav */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Close navigation menu"
          className="absolute right-2 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <Nav pendingCount={pendingCount} />
      </div>

      <main className="min-w-0 flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
