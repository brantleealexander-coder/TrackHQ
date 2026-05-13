import type { Status } from "@/lib/types";

interface StatusBadgeProps {
  status: string;
  statusInfo: Status | null;
}

export default function StatusBadge({ status, statusInfo }: StatusBadgeProps) {
  const color = statusInfo?.color ?? "#6b7280";
  const label = statusInfo?.name ?? status;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, white)`,
        color: `color-mix(in srgb, ${color} 80%, black)`,
      }}
    >
      {label}
    </span>
  );
}
