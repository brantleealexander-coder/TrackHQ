import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-only Supabase clients.
 *
 * `import "server-only"` makes Next.js throw at build time if any of
 * these get pulled into a Client Component bundle — kept separate from
 * lib/supabase.ts because that file is imported by both server and
 * client code, and `next/headers` only resolves on the server.
 */

// SSR auth-bound client for server components / route handlers. Reads the
// user's session out of request cookies and refreshes when needed.
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

// Service-role client. Bypasses RLS (still off in v1) and is required for
// Supabase Auth admin operations (invite, delete user). Never expose
// the key in a Client Component bundle — that's what `server-only` enforces.
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
