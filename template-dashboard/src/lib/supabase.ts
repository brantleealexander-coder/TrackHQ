import { createClient } from "@supabase/supabase-js";
import { createServerClient, createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Plain anon-key client (no session, no cookies). Used by query/mutation
// modules that filter by company_id explicitly; safe even with RLS off
// because the app layer scopes every query.
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Browser client for client components (status form etc).
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// SSR auth-bound client for server components / route handlers. Reads
// the user's session out of request cookies and refreshes when needed.
export function createSupabaseAuthClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll throws in Server Components — middleware refreshes
            // the session out-of-band, so this is a safe no-op there.
          }
        },
      },
    }
  );
}

// Auth client for use in client components (SSR-aware cookie storage).
export function createSupabaseBrowserAuthClient() {
  return createSsrBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Service-role client. Bypasses RLS (still off in v1) and is required
// for Supabase Auth admin operations (invite, delete user). Server-side
// only — never expose the key.
export function createSupabaseServiceClient() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) env var"
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
