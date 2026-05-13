import Nav from "@/components/nav";
import ChatWidget from "@/components/chat-widget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 p-8 overflow-auto bg-gray-50">{children}</main>
      <ChatWidget />
    </div>
  );
}
