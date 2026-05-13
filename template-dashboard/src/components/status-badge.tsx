import type { EquipmentStatus } from "@/lib/types";

const styles: Record<EquipmentStatus, string> = {
  "ON RENT":          "bg-green-100 text-green-800",
  "AVAILABLE":        "bg-blue-100 text-blue-800",
  "DOWN":             "bg-red-100 text-red-800",
  "RESERVED":         "bg-amber-100 text-amber-800",
  "IN SERVICE":       "bg-orange-100 text-orange-800",
  "OFF RENT PENDING": "bg-gray-100 text-gray-700",
};

export default function StatusBadge({ status }: { status: EquipmentStatus }) {
  const cls = styles[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}
    >
      {status}
    </span>
  );
}
