import { createClient } from "@supabase/supabase-js";
import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

// Anon-key client (no session, no cookies). Used by query/mutation modules
// that filter by company_id explicitly. Server-side reads/writes — the
// app layer scopes every query so RLS off is fine in v1.
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

// Auth client for use in client components (SSR-aware cookie storage).
export function createSupabaseBrowserAuthClient() {
  return createSsrBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// NOTE: server-only helpers (cookie-bound SSR client + service-role client)
// live in ./supabase-server.ts so this file stays safe to import from
// Client Components. Don't move them back here — Next.js compiles
// "next/headers" imports differently and any leak into a client bundle
// breaks the production build.
