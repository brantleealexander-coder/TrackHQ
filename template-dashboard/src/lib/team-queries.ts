import { createSupabaseServiceClient } from "./supabase-server";
import type { Role } from "./auth";

export interface TeamMember {
  membership_id: number;
  user_id: string;
  email: string;
  role: Role;
  joined_at: string;
  last_sign_in_at: string | null;
}

/**
 * Lists everyone with a membership in this company. Uses the service-role
 * client to read the auth.users table (auth schema isn't exposed to the
 * anon key by default).
 */
export async function listTeam(companyId: number): Promise<TeamMember[]> {
  const supabase = createSupabaseServiceClient();

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, joined_at")
    .eq("company_id", companyId)
    .order("joined_at", { ascending: true });

  if (error || !memberships) return [];

  const result: TeamMember[] = [];
  for (const m of memberships) {
    const { data: userRes } = await supabase.auth.admin.getUserById(m.user_id as string);
    const user = userRes?.user;
    if (!user) continue;
    result.push({
      membership_id: m.id as number,
      user_id: m.user_id as string,
      email: user.email ?? "",
      role: m.role as Role,
      joined_at: m.joined_at as string,
      last_sign_in_at: user.last_sign_in_at ?? null,
    });
  }
  return result;
}
