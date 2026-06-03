import { unstable_noStore as noStore } from "next/cache";
import { getCalendarOrders } from "@/lib/calendar-queries";
import CalendarView from "@/components/calendar/calendar-view";

export const dynamic = "force-dynamic";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  noStore();

  // Window: first of current month through end of next month
  const now = new Date();
  const from = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = ymd(new Date(now.getFullYear(), now.getMonth() + 2, 0));

  const orders = await getCalendarOrders(from, to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          This month and next — orders starting, ending, or in progress.
        </p>
      </div>
      <CalendarView orders={orders} monthsToShow={2} />
    </div>
  );
}
