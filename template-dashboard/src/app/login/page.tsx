"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserAuthClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Email or password is incorrect.");
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleReset() {
    setError("");
    if (!email.trim()) {
      setError("Enter your email first, then click 'Forgot password'.");
      return;
    }
    const supabase = createSupabaseBrowserAuthClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/accept-invite`,
      }
    );
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="you@yourcompany.com"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Forgot password?
          </button>
        </div>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="••••••••"
        />
      </div>

      {resetSent && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Password-reset email sent. Check your inbox.
        </div>
      )}

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
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      {/* Left: gradient panel with brand + tagline */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-500 to-brand-400 px-12 py-12 text-white lg:col-span-2 lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-10 bottom-20 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
        </div>

        <Link
          href="/"
          aria-label="TrackHQ home"
          className="relative inline-flex items-center gap-2.5 text-xl font-extrabold tracking-tight"
        >
          <svg viewBox="0 0 88 88" aria-hidden className="h-8 w-8">
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
            For rental businesses
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
            Enter your email and password to access your dashboard.
          </p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-center text-xs text-gray-500">
            Don&apos;t have an account yet?{" "}
            <Link href="/demo" className="font-medium text-gray-700 hover:text-gray-900">
              Request access
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
