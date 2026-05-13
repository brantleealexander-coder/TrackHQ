"use client";

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
}

const PERIODS = [
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "ytd", label: "Year to Date" },
  { value: "last_year", label: "Last Year" },
];

export function getPeriodDates(period: string): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.toISOString().split("T")[0];

  switch (period) {
    case "this_month":
      return {
        start: `${year}-${String(month + 1).padStart(2, "0")}-01`,
        end: today,
      };
    case "this_quarter": {
      const qStart = Math.floor(month / 3) * 3;
      return {
        start: `${year}-${String(qStart + 1).padStart(2, "0")}-01`,
        end: today,
      };
    }
    case "ytd":
      return { start: `${year}-01-01`, end: today };
    case "last_year":
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
    default:
      return { start: `${year}-01-01`, end: today };
  }
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === p.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
