import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SupabaseManagementClient } from "../clients/supabase.ts";
import type { Step, StepContext } from "../steps.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "template-dashboard",
  "supabase_schema.sql"
);

export const supabaseSchemaStep: Step = {
  name: "supabase_schema",
  describe(_ctx: StepContext): string {
    return `Run template-dashboard/supabase_schema.sql against the new project (via Management API exec_sql)`;
  },
  async execute(ctx: StepContext): Promise<void> {
    if (!ctx.env.supabase_management_token) {
      throw new Error("supabase_schema: SUPABASE_MANAGEMENT_TOKEN is required");
    }
    const create = ctx.state.steps.supabase_create;
    if (!create?.project_ref) {
      throw new Error(
        "supabase_schema: supabase_create must complete first (no project_ref in state)"
      );
    }

    const sql = readFileSync(SCHEMA_PATH, "utf8");
    console.log(`  applying schema (${sql.length} bytes)...`);

    const client = new SupabaseManagementClient(ctx.env.supabase_management_token);
    await client.runSql(create.project_ref, sql);
    console.log(`  schema applied`);

    ctx.state.steps.supabase_schema = {
      completed_at: new Date().toISOString(),
    };
  },
};
