"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase";

/**
 * /accept-invite — landing after Supabase Auth recovery / invite link.
 * The /auth/callback route has already exchanged the code and put a
 * session in the cookie store, so here we just prompt the user to set
 * (or reset) their password and bounce them to the dashboard.
 */
export default function AcceptInvitePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserAuthClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserAuthClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.push("/app/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-5">
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
            Welcome aboard
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight">
            Set a password and we&apos;ll drop you straight into your dashboard.
          </p>
        </div>

        <p className="relative text-xs text-white/60">Built for rental businesses.</p>
      </aside>

      <main className="flex items-center justify-center bg-white px-6 py-16 lg:col-span-3">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Link href="/" aria-label="TrackHQ home" className="inline-flex items-center">
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

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Set your password
          </h1>
          {email && (
            <p className="mt-1.5 text-sm text-gray-500">
              For <span className="font-medium text-gray-700">{email}</span>
            </p>
          )}

          {!ready ? (
            <p className="mt-8 text-sm text-gray-500">Checking your invite…</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={8}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? "Setting password…" : "Set password and continue →"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
