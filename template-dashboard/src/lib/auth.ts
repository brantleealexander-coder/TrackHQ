/**
 * Auth + tenancy helpers. Every server component and route handler under
 * /app/* calls requireMembership() once at the top, then threads
 * `membership.company_id` into the queries it runs.
 *
 * Roles: owner > admin > member.
 *   - owner   = company creator, full control + billing (deferred)
 *   - admin   = full data access + can invite teammates
 *   - member  = uses the app but cannot invite
 *
 * super_admins is a separate table for TrackHQ-internal staff. Used by
 * the /super-admin/* pages only.
 */

import { redirect } from "next/navigation";
import { createSupabaseAuthClient } from "@/lib/supabase";

export type Role = "owner" | "admin" | "member";

export interface Membership {
  user_id: string;
  company_id: number;
  role: Role;
  company: {
    id: number;
    name: string;
    slug: string;
    brand_color: string | null;
    logo_url: string | null;
  };
}

interface SupabaseUserLike {
  id: string;
  email?: string | null;
}

export async function getCurrentUser(): Promise<SupabaseUserLike | null> {
  const supabase = createSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user
    ? { id: user.id, email: user.email ?? null }
    : null;
}

export async function getCurrentMembership(): Promise<Membership | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      `user_id, company_id, role,
       companies ( id, name, slug, brand_color, logo_url )`
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const companyRaw = (data as { companies: unknown }).companies;
  const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
  if (!company) return null;
  return {
    user_id: data.user_id as string,
    company_id: data.company_id as number,
    role: data.role as Role,
    company: company as Membership["company"],
  };
}

export async function requireMembership(): Promise<Membership> {
  const m = await getCurrentMembership();
  if (!m) redirect("/login");
  return m;
}

export async function requireRole(allowed: Role[]): Promise<Membership> {
  const m = await requireMembership();
  if (!allowed.includes(m.role)) redirect("/app/dashboard");
  return m;
}

export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = createSupabaseAuthClient();
  const { data } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

export async function requireSuperAdmin(): Promise<SupabaseUserLike> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = await isSuperAdmin();
  if (!ok) redirect("/app/dashboard");
  return user;
}
