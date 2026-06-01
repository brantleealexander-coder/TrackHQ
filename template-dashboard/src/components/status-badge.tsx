import type { Status } from "@/lib/types";

interface StatusBadgeProps {
  status: string;
  statusInfo: Status | null;
}

const FALLBACK_COLOR = "#6b7280";

export default function StatusBadge({ status, statusInfo }: StatusBadgeProps) {
  const color = statusInfo?.color ?? FALLBACK_COLOR;
  const label = statusInfo?.name ?? status;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 12%, white)`,
        color: `color-mix(in srgb, ${color} 75%, black)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 22%, white)`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
