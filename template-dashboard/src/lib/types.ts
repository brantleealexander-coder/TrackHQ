// Status keys are tenant-defined (stored in the `statuses` table). Application
// code should switch on a Status's `behavior` field, not its key or name —
// see [[trackhq-overview]]. The string alias is kept so call sites that
// previously took an `EquipmentStatus` don't all need to change.
export type EquipmentStatus = string;

// Stable behaviors that the application logic understands. Customers can name
// their statuses anything; behavior decouples display from semantics.
export type StatusBehavior =
  | "rented"
  | "available"
  | "out_of_service"
  | "reserved"
  | "pending_return";

export type RateType = "daily" | "weekly" | "monthly";

export interface Category {
  id: number;
  name: string;
}

export interface Status {
  key: string;
  name: string;
  color: string;
  behavior: StatusBehavior;
  sort_order: number;
}

export interface Location {
  id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Equipment {
  id: number;
  gl_code: string;
  serial_number: string | null;
  category_id: number;
  equipment_name: string;
  year: number | null;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
  home_location_id: number | null;
  current_address: string | null;
  current_lat: number | null;
  current_lng: number | null;
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

// Joined type used in fleet page.
// Supabase returns equipment_status as an array (the FK lives on the child).
export interface EquipmentWithStatus extends Equipment {
  equipment_status: EquipmentStatusRow[] | null;
  categories: Category | null;
  locations: Location | null;
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
  gateway_serial: string | null;
  samsara_id: string;
  samsara_name: string | null;
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

// Flattened row used in tables. Status fields come from the
// `equipment_status` table; category_name / home_location_name come from
// joins to `categories` / `locations`.
export interface FleetRow {
  id: number;
  gl_code: string;
  serial_number: string | null;
  category_id: number;
  category_name: string;
  equipment_name: string;
  year: number | null;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
  home_location_id: number | null;
  home_location_name: string | null;
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
