// Pure financial calculation functions — no Supabase calls here.

import type { Status } from "./types";

export interface FleetSummary {
  totalUnits: number;
  onRentCount: number;
  availableCount: number;
  downCount: number;
  reservedCount: number;
  utilization: number; // percentage 0–100
}

// Aggregate per-status-key counts into per-behavior counts so the fleet
// summary works for any tenant's status taxonomy.
function countByBehavior(
  statusCounts: Record<string, number>,
  statuses: Status[]
): Record<string, number> {
  const behaviorByKey = new Map<string, string>(statuses.map((s) => [s.key, s.behavior]));
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(statusCounts)) {
    const behavior = behaviorByKey.get(key) ?? "unknown";
    out[behavior] = (out[behavior] ?? 0) + count;
  }
  return out;
}

export interface RevenueSummary {
  monthlyRevenue: number;   // closed rentals that started this month
  ytdRevenue: number;       // closed rentals that started this year
  activeRentRevenue: number; // projected from currently rented units (to rental_end or today)
  totalAllTime: number;
}

export interface OverdueRental {
  glCode: string;
  equipmentName: string;
  customerName: string;
  rentalEnd: string;
  daysOverdue: number;
}

export interface RevenueByUnit {
  equipmentId: number;
  glCode: string;
  equipmentName: string;
  totalRevenue: number;
}

// ─── Fleet summary ───────────────────────────────────────────────────────────

export function computeFleetSummary(
  statusCounts: Record<string, number>,
  totalUnits: number,
  statuses: Status[]
): FleetSummary {
  const byBehavior = countByBehavior(statusCounts, statuses);
  const onRent = byBehavior.rented ?? 0;
  const available = byBehavior.available ?? 0;
  const down = byBehavior.out_of_service ?? 0;
  const reserved = byBehavior.reserved ?? 0;
  // Exclude out-of-service units from the utilization denominator — they
  // can't be rented.
  const rentable = totalUnits - down;
  const utilization = rentable > 0 ? Math.round((onRent / rentable) * 100) : 0;

  return {
    totalUnits,
    onRentCount: onRent,
    availableCount: available,
    downCount: down,
    reservedCount: reserved,
    utilization,
  };
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

interface HistoryRow {
  revenue_amount: number | null;
  rental_start: string | null;
}

export function computeRevenueSummary(
  history: HistoryRow[],
  activeRentals: ActiveRentalRow[]
): RevenueSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  let monthlyRevenue = 0;
  let ytdRevenue = 0;
  let totalAllTime = 0;

  for (const row of history) {
    const amount = row.revenue_amount ?? 0;
    if (amount === 0) continue;
    totalAllTime += amount;

    if (row.rental_start) {
      const start = new Date(row.rental_start);
      if (start >= yearStart) ytdRevenue += amount;
      if (start >= monthStart) monthlyRevenue += amount;
    }
  }

  // Projected revenue from currently active rentals
  let activeRentRevenue = 0;
  for (const rental of activeRentals) {
    const projected = computeRentalRevenue(rental, now);
    activeRentRevenue += projected;
  }

  return { monthlyRevenue, ytdRevenue, activeRentRevenue, totalAllTime };
}

interface ActiveRentalRow {
  rental_start: string | null;
  rental_end: string | null;
  rate_type: string | null;
  equipment: {
    rate_daily: number | null;
    rate_weekly: number | null;
    rate_monthly: number | null;
    gl_code: string;
    equipment_name: string;
  } | null;
}

function computeRentalRevenue(rental: ActiveRentalRow, today: Date): number {
  if (!rental.rental_start || !rental.rate_type || !rental.equipment) return 0;
  const start = new Date(rental.rental_start);
  const end = rental.rental_end ? new Date(rental.rental_end) : today;
  return calcRevenue(
    rental.rate_type,
    rental.equipment.rate_daily ?? 0,
    rental.equipment.rate_weekly ?? 0,
    rental.equipment.rate_monthly ?? 0,
    start,
    end
  );
}

export function calcRevenue(
  rateType: string,
  rateDaily: number,
  rateWeekly: number,
  rateMonthly: number,
  start: Date,
  end: Date
): number {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  const days = Math.max(1, Math.ceil(ms / 86400000));
  if (rateType === "daily") return days * rateDaily;
  if (rateType === "weekly") return Math.ceil(days / 7) * rateWeekly;
  if (rateType === "monthly") return Math.ceil(days / 30) * rateMonthly;
  return 0;
}

// ─── Overdue ─────────────────────────────────────────────────────────────────

interface StatusRow {
  gl_code: string;
  equipment_name: string;
  customer_name: string | null;
  rental_end: string | null;
  status: string;
}

export function findOverdueRentals(
  fleet: StatusRow[],
  statuses: Status[],
  today: Date = new Date()
): OverdueRental[] {
  const behaviorByKey = new Map<string, string>(statuses.map((s) => [s.key, s.behavior]));
  const results: OverdueRental[] = [];
  for (const row of fleet) {
    if (behaviorByKey.get(row.status) !== "rented" || !row.rental_end) continue;
    const end = new Date(row.rental_end);
    if (end < today) {
      const daysOverdue = Math.ceil(
        (today.getTime() - end.getTime()) / 86400000
      );
      results.push({
        glCode: row.gl_code,
        equipmentName: row.equipment_name,
        customerName: row.customer_name ?? "Unknown",
        rentalEnd: row.rental_end,
        daysOverdue,
      });
    }
  }
  return results.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ─── Revenue by unit ─────────────────────────────────────────────────────────

interface HistoryWithEquipment {
  equipment_id: number;
  revenue_amount: number | null;
}

export function computeRevenueByUnit(
  history: HistoryWithEquipment[],
  equipmentMap: Map<number, { gl_code: string; equipment_name: string }>
): RevenueByUnit[] {
  const map = new Map<number, number>();
  for (const row of history) {
    if (!row.revenue_amount) continue;
    map.set(row.equipment_id, (map.get(row.equipment_id) ?? 0) + row.revenue_amount);
  }

  const result: RevenueByUnit[] = [];
  for (const [equipmentId, total] of map.entries()) {
    const eq = equipmentMap.get(equipmentId);
    if (!eq) continue;
    result.push({
      equipmentId,
      glCode: eq.gl_code,
      equipmentName: eq.equipment_name,
      totalRevenue: total,
    });
  }
  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

export interface MaintenanceSummary {
  monthlyMaintenance: number;
  ytdMaintenance: number;
  totalAllTimeMaintenance: number;
}

export interface MaintenanceByUnit {
  equipmentId: number;
  glCode: string;
  equipmentName: string;
  totalMaintenance: number;
}

interface MaintenanceRow {
  equipment_id: number;
  date: string | null;
  cost: number | null;
}

export function computeMaintenanceSummary(logs: MaintenanceRow[]): MaintenanceSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  let monthly = 0;
  let ytd = 0;
  let allTime = 0;

  for (const log of logs) {
    const cost = log.cost ?? 0;
    if (cost === 0) continue;
    allTime += cost;
    if (log.date) {
      const d = new Date(log.date + "T00:00:00");
      if (d >= yearStart) ytd += cost;
      if (d >= monthStart) monthly += cost;
    }
  }

  return {
    monthlyMaintenance: monthly,
    ytdMaintenance: ytd,
    totalAllTimeMaintenance: allTime,
  };
}

export function computeMaintenanceByUnit(
  logs: MaintenanceRow[],
  equipmentMap: Map<number, { gl_code: string; equipment_name: string }>
): MaintenanceByUnit[] {
  const map = new Map<number, number>();
  for (const log of logs) {
    if (!log.cost) continue;
    map.set(log.equipment_id, (map.get(log.equipment_id) ?? 0) + log.cost);
  }

  const result: MaintenanceByUnit[] = [];
  for (const [equipmentId, total] of map.entries()) {
    const eq = equipmentMap.get(equipmentId);
    if (!eq) continue;
    result.push({
      equipmentId,
      glCode: eq.gl_code,
      equipmentName: eq.equipment_name,
      totalMaintenance: total,
    });
  }
  return result.sort((a, b) => b.totalMaintenance - a.totalMaintenance);
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
