import { unstable_noStore as noStore } from "next/cache";
import { requireMembership } from "@/lib/auth";
import { listTeam } from "@/lib/team-queries";
import TeamPanel from "@/components/team/team-panel";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  noStore();
  const membership = await requireMembership();
  const team = await listTeam(membership.company_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage who can access {membership.company.name}.
        </p>
      </div>
      <TeamPanel
        members={team}
        currentUserId={membership.user_id}
        currentRole={membership.role}
      />
    </div>
  );
}
