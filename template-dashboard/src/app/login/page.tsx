"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTenantConfig } from "@/lib/tenant-config";

export default function LoginPage() {
  const router = useRouter();
  const { business } = getTenantConfig();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/app/dashboard");
      router.refresh();
    } else {
      setError("Incorrect password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      {/* Left: gradient panel with brand + tagline */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-500 to-brand-400 px-12 py-12 text-white lg:col-span-2 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-10 bottom-20 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
        </div>

        <Link
          href="/"
          aria-label="TrackHQ home"
          className="relative inline-flex items-center gap-2.5 text-xl font-extrabold tracking-tight"
        >
          <svg
            viewBox="0 0 88 88"
            aria-hidden
            className="h-8 w-8"
          >
            <path
              d="M44 6C25.6 6 11 20.6 11 38.5 11 62 44 86 44 86s33-24 33-47.5C77 20.6 62.4 6 44 6z"
              fill="rgba(255,255,255,0.95)"
            />
            <circle cx="44" cy="37" r="13" fill="#F37535" />
          </svg>
          <span>
            Track<span className="text-white/90">HQ</span>
          </span>
        </Link>

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
            {business.name}
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight">
            One screen for every rental, every yard, every dollar.
          </p>
          <p className="mt-3 text-sm text-white/80">
            Sign in to manage your fleet, log maintenance, and check the day&apos;s revenue.
          </p>
        </div>

        <p className="relative text-xs text-white/60">
          Built for rental businesses. Hosted by TrackHQ.
        </p>
      </aside>

      {/* Right: form */}
      <main className="flex items-center justify-center bg-white px-6 py-16 lg:col-span-3">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Link
              href="/"
              aria-label="TrackHQ home"
              className="inline-flex items-center"
            >
              <Image
                src="/trackhq-logo.svg"
                alt="TrackHQ"
                width={140}
                height={34}
                priority
                unoptimized
                className="h-8 w-auto"
              />
            </Link>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Enter your dashboard password.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500">
            Need access? <Link href="/contact" className="font-medium text-gray-700 hover:text-gray-900">Contact your operator.</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
