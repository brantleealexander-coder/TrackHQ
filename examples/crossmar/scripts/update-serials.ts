/**
 * update-serials.ts — one-time script to populate serial_number column
 * from an updated equipment spreadsheet
 *
 * Run from the template-dashboard directory:
 *   npx ts-node --project tsconfig.seed.json scripts/update-serials.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_KEY=...  (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const EXCEL_PATH = path.resolve(__dirname, "../../CrossMar DC III Equipment.xlsx");
const GL_PATTERN = /^\d{2}-/;

async function updateSerials() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key);

  // Read Excel
  console.log("Reading Excel file:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

  // Column layout: 0=GL Code, 1=Serial Number, 2=Equipment Name, ...
  let updated = 0;
  let skipped = 0;
  let noSerial = 0;
  let errors = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const glCode = row[0] ? String(row[0]).trim() : "";
    const serialNumber = row[1] ? String(row[1]).trim() : "";

    if (!glCode || !GL_PATTERN.test(glCode)) {
      skipped++;
      continue;
    }

    if (!serialNumber) {
      noSerial++;
      continue;
    }

    const { error } = await supabase
      .from("equipment")
      .update({ serial_number: serialNumber })
      .eq("gl_code", glCode);

    if (error) {
      console.error(`  Error updating ${glCode}: ${error.message}`);
      errors++;
    } else {
      updated++;
      console.log(`  ${glCode} → ${serialNumber}`);
    }
  }

  console.log("\nUpdate complete!");
  console.log(`  Updated: ${updated}`);
  console.log(`  No serial number: ${noSerial}`);
  console.log(`  Skipped (division headers): ${skipped}`);
  if (errors > 0) console.log(`  Errors: ${errors}`);
}

updateSerials().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
