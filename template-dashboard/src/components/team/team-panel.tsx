"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamMember } from "@/lib/team-queries";
import type { Role } from "@/lib/auth";

interface TeamPanelProps {
  members: TeamMember[];
  currentUserId: string;
  currentRole: Role;
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_HELP: Record<Role, string> = {
  owner: "Full control, billing, can transfer ownership.",
  admin: "Full data access, can invite teammates.",
  member: "Uses the app; cannot invite or remove others.",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TeamPanel({ members, currentUserId, currentRole }: TeamPanelProps) {
  const router = useRouter();
  const canInvite = currentRole === "owner" || currentRole === "admin";
  const canRemoveOthers = currentRole === "owner";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setInviting(true);
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const json = await res.json();
    setInviting(false);
    if (!res.ok) {
      setError(json?.error ?? "Could not send invite.");
      return;
    }
    setNotice(`Invite email sent to ${email.trim()}.`);
    setEmail("");
    setRole("member");
    router.refresh();
  }

  async function remove(membershipId: number) {
    if (!confirm("Remove this person from the team?")) return;
    const res = await fetch(`/api/team/${membershipId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      alert(json?.error ?? "Could not remove member.");
      return;
    }
    router.refresh();
  }

  const ownerCount = members.filter((m) => m.role === "owner").length;

  return (
    <div className="space-y-8">
      {canInvite && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Invite teammate
          </h2>
          <form onSubmit={invite} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@yourcompany.com"
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              {currentRole === "owner" && <option value="owner">Owner</option>}
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-50"
            >
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </form>
          <p className="mt-2 text-xs text-gray-500">{ROLE_HELP[role]}</p>
          {notice && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50/80">
            <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Joined</th>
              <th className="px-4 py-2.5">Last sign-in</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const removable =
                canRemoveOthers &&
                !isSelf &&
                !(m.role === "owner" && ownerCount <= 1);
              return (
                <tr key={m.membership_id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{m.email}</p>
                    {isSelf && (
                      <p className="text-[11px] text-gray-400">(you)</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                      {ROLE_LABEL[m.role]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{fmtDate(m.joined_at)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">
                    {m.last_sign_in_at ? fmtDate(m.last_sign_in_at) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {removable ? (
                      <button
                        onClick={() => remove(m.membership_id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
