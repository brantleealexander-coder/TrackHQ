import DashboardShell from "@/components/dashboard-shell";
import ChatWidget from "@/components/chat-widget";
import { getTenantConfig } from "@/lib/tenant-config";
import { requireMembership } from "@/lib/auth";
import { countPendingBookingRequests } from "@/lib/booking-request-queries";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { features } = getTenantConfig();
  const { company_id } = await requireMembership();
  const pendingCount = await countPendingBookingRequests(company_id).catch(() => 0);
  return (
    <>
      <DashboardShell pendingCount={pendingCount}>{children}</DashboardShell>
      {features.chatbot && <ChatWidget />}
    </>
  );
}
