export type EquipmentStatus =
  | "ON RENT"
  | "AVAILABLE"
  | "DOWN"
  | "RESERVED"
  | "IN SERVICE"
  | "OFF RENT PENDING";

export type RateType = "daily" | "weekly" | "monthly";

export interface Division {
  id: number;
  name: string;
}

export interface Equipment {
  id: number;
  gl_code: string;
  serial_number: string | null;
  division_id: number;
  equipment_name: string;
  year: number | null;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
  home_yard: string | null;
  is_cross_charge: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentStatusRow {
  id: number;
  equipment_id: number;
  status: EquipmentStatus;
  customer_name: string | null;
  job_po_notes: string | null;
  rate_type: RateType | null;
  rental_start: string | null;
  rental_end: string | null;
  updated_at: string;
  updated_by: string;
}

export interface RentalHistory {
  id: number;
  equipment_id: number;
  status_before: string | null;
  status_after: string;
  customer_name: string | null;
  job_po_notes: string | null;
  rate_type: RateType | null;
  rental_start: string | null;
  rental_end: string | null;
  revenue_amount: number | null;
  recorded_at: string;
  recorded_by: string;
}

// Joined type used in fleet page
// Supabase returns equipment_status as an array (foreign key is on the child table)
export interface EquipmentWithStatus extends Equipment {
  equipment_status: EquipmentStatusRow[] | null;
  divisions: Division | null;
}

export interface MaintenanceLog {
  id: number;
  equipment_id: number;
  date: string;
  cost: number;
  description: string;
  vendor: string | null;
  category: string | null;
  invoice_number: string | null;
  created_at: string;
  created_by: string;
}

export interface SamsaraDevice {
  id: number;
  gateway_serial: string | null;     // real hardware serial, e.g. "G522-SBG-JT9"
  samsara_id: string;                // stable Samsara asset id — primary identity
  samsara_name: string | null;       // user-set asset name from Samsara
  notes: string | null;
  equipment_id: number | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

// Joined view used by the admin page and the map.
export interface SamsaraDeviceWithEquipment extends SamsaraDevice {
  equipment: {
    id: number;
    gl_code: string;
    equipment_name: string;
    status: EquipmentStatus;
  } | null;
}

// Flattened row used in tables
export interface FleetRow {
  id: number;
  gl_code: string;
  serial_number: string | null;
  division_id: number;
  division_name: string;
  equipment_name: string;
  year: number | null;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
  home_yard: string | null;
  is_cross_charge: boolean;
  status: EquipmentStatus;
  customer_name: string | null;
  job_po_notes: string | null;
  rate_type: RateType | null;
  rental_start: string | null;
  rental_end: string | null;
  status_updated_at: string | null;
  current_address: string | null;
  current_lat: number | null;
  current_lng: number | null;
}
