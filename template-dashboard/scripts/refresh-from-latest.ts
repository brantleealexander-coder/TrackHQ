/**
 * refresh-from-latest.ts — refresh equipment + equipment_status from
 * "latest equipment status report.xlsx".
 *
 * Run from the template-dashboard directory:
 *   npm run refresh
 *
 * Differences from seed.ts:
 *   - Reads the new file at ../latest equipment status report.xlsx
 *   - New column order: GL Code | Equipment Name | Serial Number | Year | ...
 *   - Standardizes yard text containing "midland" to the canonical Midland TX
 *     address that fleet-map.tsx already knows about.
 *   - For four GL codes whose serial was meaningfully truncated in the new
 *     file, leaves the existing DB serial alone to protect VisionLink GPS
 *     matching.
 *   - For eight GL codes whose "Customer" cell is actually an internal note,
 *     routes that text into job_po_notes and leaves customer_name null.
 *   - Never writes rental_start, rental_end, or rate_type — those are
 *     dashboard-managed values that must survive the refresh.
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const EXCEL_PATH = path.resolve(__dirname, "../../latest equipment status report.xlsx");
const BATCH_SIZE = 50;
const REFRESH_TAG = `refresh-${new Date().toISOString().slice(0, 10)}`;

const DIVISION_MAP: Record<string, number> = {
  "01": 1,  "02": 2,  "03": 3,  "04": 4,  "05": 5,
  "06": 6,  "07": 7,  "08": 8,  "09": 9,  "10": 10,
  "11": 11, "12": 12, "13": 13, "14": 14, "15": 15,
  "16": 16, "17": 17, "18": 18, "19": 19,
};

const GL_PATTERN = /^\d{2}-/;

const MIDLAND_CANONICAL = "10315 FM 307 Midland, TX 79706";

// Four units whose new-file serial is a meaningful truncation that may break
// VisionLink GPS matching. Spreadsheet "Serial Number" cell is ignored for
// these — DB value is preserved.
const PRESERVE_OLD_SERIAL = new Set<string>([
  "05-2072",
  "05-3100",
  "10-6536",
  "17-9559",
]);

// Eight units whose new-file "Customer" cell is an internal note ("CC,
// Brother in law", "shop, easton", "in shop, kyle", etc.) rather than an
// actual customer name. The cell text goes to job_po_notes; customer_name
// stays null.
const CUSTOMER_AS_NOTE = new Set<string>([
  "01-1368",
  "02-1033",
  "02-1081",
  "02-1083",
  "02-1103",
  "03-8240",
  "04-4124",
  "16-0320",
]);

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function toInt(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

function normalizeYard(raw: string | null): string | null {
  if (!raw) return null;
  if (/midland/i.test(raw)) return MIDLAND_CANONICAL;
  return raw;
}

function normalizeStatus(raw: string | null): string {
  if (!raw) return "AVAILABLE";
  const s = raw.trim().toUpperCase();
  if (s === "ON RENT") return "ON RENT";
  if (s === "AVAILABLE") return "AVAILABLE";
  if (s === "DOWN") return "DOWN";
  if (s === "RESERVED") return "RESERVED";
  if (s === "IN SERVICE") return "IN SERVICE";
  if (s.includes("OFF RENT") || s === "OFF RENT PENDING") return "OFF RENT PENDING";
  if (s === "NA" || s === "N/A" || s === "TBD") return "AVAILABLE";
  console.warn(`  Unknown status "${raw}" — defaulting to AVAILABLE`);
  return "AVAILABLE";
}

type EquipmentRow = {
  gl_code: string;
  serial_number?: string | null;
  division_id: number;
  equipment_name: string;
  year: number | null;
  rate_daily: number | null;
  rate_weekly: number | null;
  rate_monthly: number | null;
  home_yard: string | null;
  is_cross_charge: boolean;
};

type StatusInfo = {
  status: string;
  customer_name: string | null;
  job_po_notes: string | null;
};

async function refresh() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log("Reading Excel file:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

  console.log(`Total rows in sheet: ${rows.length}`);

  const equipmentRows: EquipmentRow[] = [];
  const statusMap = new Map<string, StatusInfo>();

  // New-file column layout:
  //   0=GL Code  1=Equipment Name  2=Serial Number  3=Year
  //   4=Daily    5=Weekly          6=Monthly        7=Current Status
  //   8=Home Yard 9=Customer       10=Job/PO#/Notes
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const glCode = toStr(row[0]);

    if (!glCode || !GL_PATTERN.test(glCode)) continue;

    const prefix = glCode.slice(0, 2);
    const divisionId = DIVISION_MAP[prefix];
    if (!divisionId) {
      console.warn(`Row ${i + 1}: Unknown division prefix "${prefix}" for GL code "${glCode}" — skipping`);
      continue;
    }

    const equipName = toStr(row[1]);
    if (!equipName) {
      console.warn(`Row ${i + 1}: No equipment name for GL code "${glCode}" — skipping`);
      continue;
    }

    const serialNumber = toStr(row[2]);
    const isCrossCharge = /^CC+\s/i.test(equipName);

    const eqRow: EquipmentRow = {
      gl_code: glCode,
      division_id: divisionId,
      equipment_name: equipName,
      year: toInt(row[3]),
      rate_daily: toNum(row[4]),
      rate_weekly: toNum(row[5]),
      rate_monthly: toNum(row[6]),
      home_yard: normalizeYard(toStr(row[8])),
      is_cross_charge: isCrossCharge,
    };

    // Only include serial_number in the payload when we want to update it.
    // Omitting it from the upsert leaves the existing DB value alone.
    if (!PRESERVE_OLD_SERIAL.has(glCode)) {
      eqRow.serial_number = serialNumber;
    }

    equipmentRows.push(eqRow);

    const customerCell = toStr(row[9]);
    const notesCell = toStr(row[10]);

    let customer_name: string | null;
    let job_po_notes: string | null;
    if (CUSTOMER_AS_NOTE.has(glCode)) {
      customer_name = null;
      // If both cells are populated, join them so neither is lost.
      job_po_notes = [customerCell, notesCell].filter(Boolean).join(" — ") || null;
    } else {
      customer_name = customerCell;
      job_po_notes = notesCell;
    }

    statusMap.set(glCode, {
      status: normalizeStatus(toStr(row[7])),
      customer_name,
      job_po_notes,
    });
  }

  console.log(`Parsed ${equipmentRows.length} equipment rows`);
  console.log(`  Serials preserved (skipped in upsert):  ${PRESERVE_OLD_SERIAL.size}`);
  console.log(`  Customer cells routed to notes:         ${CUSTOMER_AS_NOTE.size}`);

  console.log("\nUpserting equipment master rows…");
  for (let i = 0; i < equipmentRows.length; i += BATCH_SIZE) {
    const batch = equipmentRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("equipment")
      .upsert(batch, { onConflict: "gl_code" });
    if (error) {
      console.error(`Batch error (rows ${i}–${i + BATCH_SIZE}):`, error.message);
      process.exit(1);
    }
    console.log(`  Upserted rows ${i + 1}–${Math.min(i + BATCH_SIZE, equipmentRows.length)}`);
  }

  console.log("\nFetching equipment IDs…");
  const { data: equipData, error: fetchErr } = await supabase
    .from("equipment")
    .select("id, gl_code");
  if (fetchErr) {
    console.error("Failed to fetch equipment:", fetchErr.message);
    process.exit(1);
  }

  const statusRows = equipData!
    .filter((eq: { id: number; gl_code: string }) => statusMap.has(eq.gl_code))
    .map((eq: { id: number; gl_code: string }) => {
      const s = statusMap.get(eq.gl_code)!;
      return {
        equipment_id: eq.id,
        status: s.status,
        customer_name: s.customer_name,
        job_po_notes: s.job_po_notes,
        updated_by: REFRESH_TAG,
        // Intentionally NOT setting rental_start, rental_end, rate_type —
        // omitting them from the upsert payload preserves whatever the
        // dashboard has stored.
      };
    });

  console.log(`\nUpserting ${statusRows.length} equipment_status rows…`);
  for (let i = 0; i < statusRows.length; i += BATCH_SIZE) {
    const batch = statusRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("equipment_status")
      .upsert(batch, { onConflict: "equipment_id" });
    if (error) {
      console.error(`Status batch error (rows ${i}–${i + BATCH_SIZE}):`, error.message);
      process.exit(1);
    }
    console.log(`  Upserted status rows ${i + 1}–${Math.min(i + BATCH_SIZE, statusRows.length)}`);
  }

  console.log("\nRefresh complete!");
  console.log(`  Equipment rows upserted: ${equipmentRows.length}`);
  console.log(`  Status rows upserted:    ${statusRows.length}`);
  console.log(`  updated_by tag:          ${REFRESH_TAG}`);

  const counts: Record<string, number> = {};
  for (const s of statusRows) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }
  console.log("\nStatus breakdown:");
  for (const [status, count] of Object.entries(counts).sort()) {
    console.log(`  ${status.padEnd(20)} ${count}`);
  }
}

refresh().catch((err) => {
  console.error("Refresh failed:", err);
  process.exit(1);
});
