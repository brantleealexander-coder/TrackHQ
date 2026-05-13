/**
 * seed.ts — one-time import of an equipment spreadsheet into Supabase
 *
 * Run from the template-dashboard directory:
 *   npm run seed
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_KEY=...  (service role key — bypasses RLS)
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const EXCEL_PATH = path.resolve(__dirname, "../../CrossMar DC III Equipment.xlsx");
const BATCH_SIZE = 50;

// Division prefix → division_id
const DIVISION_MAP: Record<string, number> = {
  "01": 1,  "02": 2,  "03": 3,  "04": 4,  "05": 5,
  "06": 6,  "07": 7,  "08": 8,  "09": 9,  "10": 10,
  "11": 11, "12": 12, "13": 13, "14": 14, "15": 15,
  "16": 16, "17": 17, "18": 18, "19": 19,
};

// Valid GL code pattern: starts with two digits and a dash
const GL_PATTERN = /^\d{2}-/;

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

async function seed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Read Excel
  console.log("Reading Excel file:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

  console.log(`Total rows in sheet: ${rows.length}`);

  // Parse equipment rows — skip header row (row 0) and division header rows
  const equipmentRows: {
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
  }[] = [];

  const statusMap: Map<string, { status: string; customer: string | null; job_po: string | null }> = new Map();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const glCode = toStr(row[0]);

    // Skip empty rows and division header rows (no dash in position 2-3)
    if (!glCode || !GL_PATTERN.test(glCode)) continue;

    const prefix = glCode.slice(0, 2);
    const divisionId = DIVISION_MAP[prefix];
    if (!divisionId) {
      console.warn(`Row ${i + 1}: Unknown division prefix "${prefix}" for GL code "${glCode}" — skipping`);
      continue;
    }

    // Column layout (updated with Serial Number in column B):
    // 0=GL Code, 1=Serial Number, 2=Equipment Name, 3=Year,
    // 4=Daily, 5=Weekly, 6=Monthly, 7=Status, 8=Home Yard,
    // 9=Customer, 10=Job/PO#/Notes
    const serialNumber = toStr(row[1]);
    const equipName = toStr(row[2]);
    if (!equipName) {
      console.warn(`Row ${i + 1}: No equipment name for GL code "${glCode}" — skipping`);
      continue;
    }

    // Detect cross-charge: equipment name starts with "CC" or "CCCC"
    const isCrossCharge = /^CC+\s/i.test(equipName);

    const rawStatus = toStr(row[7]);
    const normalizedStatus = normalizeStatus(rawStatus);

    equipmentRows.push({
      gl_code: glCode,
      serial_number: serialNumber,
      division_id: divisionId,
      equipment_name: equipName,
      year: toInt(row[3]),
      rate_daily: toNum(row[4]),
      rate_weekly: toNum(row[5]),
      rate_monthly: toNum(row[6]),
      home_yard: toStr(row[8]),
      is_cross_charge: isCrossCharge,
    });

    statusMap.set(glCode, {
      status: normalizedStatus,
      customer: toStr(row[9]),
      job_po: toStr(row[10]),
    });
  }

  console.log(`Parsed ${equipmentRows.length} equipment rows`);

  // Insert equipment in batches
  console.log("Inserting equipment...");
  for (let i = 0; i < equipmentRows.length; i += BATCH_SIZE) {
    const batch = equipmentRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("equipment")
      .upsert(batch, { onConflict: "gl_code" });
    if (error) {
      console.error(`Batch insert error (rows ${i}–${i + BATCH_SIZE}):`, error.message);
      process.exit(1);
    }
    console.log(`  Inserted rows ${i + 1}–${Math.min(i + BATCH_SIZE, equipmentRows.length)}`);
  }

  // Fetch back all equipment to get their IDs
  console.log("Fetching equipment IDs...");
  const { data: equipData, error: fetchErr } = await supabase
    .from("equipment")
    .select("id, gl_code");
  if (fetchErr) {
    console.error("Failed to fetch equipment:", fetchErr.message);
    process.exit(1);
  }

  // Build equipment_status rows
  const statusRows = equipData!.map((eq: { id: number; gl_code: string }) => {
    const s = statusMap.get(eq.gl_code) ?? { status: "AVAILABLE", customer: null, job_po: null };
    return {
      equipment_id: eq.id,
      status: s.status,
      customer_name: s.customer,
      job_po_notes: s.job_po,
      updated_by: "seed",
    };
  });

  console.log(`Inserting ${statusRows.length} equipment_status rows...`);
  for (let i = 0; i < statusRows.length; i += BATCH_SIZE) {
    const batch = statusRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("equipment_status")
      .upsert(batch, { onConflict: "equipment_id" });
    if (error) {
      console.error(`Status batch error (rows ${i}–${i + BATCH_SIZE}):`, error.message);
      process.exit(1);
    }
    console.log(`  Inserted status rows ${i + 1}–${Math.min(i + BATCH_SIZE, statusRows.length)}`);
  }

  console.log("\nSeed complete!");
  console.log(`  Equipment rows: ${equipmentRows.length}`);
  console.log(`  Status rows:    ${statusRows.length}`);

  // Print status breakdown
  const counts: Record<string, number> = {};
  for (const s of statusRows) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }
  console.log("\nStatus breakdown:");
  for (const [status, count] of Object.entries(counts).sort()) {
    console.log(`  ${status}: ${count}`);
  }
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
  // Default unknown statuses to AVAILABLE
  console.warn(`  Unknown status "${raw}" — defaulting to AVAILABLE`);
  return "AVAILABLE";
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
