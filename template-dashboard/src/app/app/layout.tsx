import DashboardShell from "@/components/dashboard-shell";
import ChatWidget from "@/components/chat-widget";
import { getTenantConfig } from "@/lib/tenant-config";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { features } = getTenantConfig();
  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      {features.chatbot && <ChatWidget />}
    </>
  );
}
