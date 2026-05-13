interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "blue" | "red" | "amber" | "gray" | "orange";
}

const accentMap = {
  green:  "border-green-400",
  blue:   "border-blue-400",
  red:    "border-red-400",
  amber:  "border-amber-400",
  gray:   "border-gray-300",
  orange: "border-orange-400",
};

export default function StatCard({ label, value, sub, accent = "gray" }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border-l-4 ${accentMap[accent]}`}>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
