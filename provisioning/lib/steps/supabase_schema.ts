import { NotYetImplementedError, type Step, type StepContext } from "../steps.ts";

export const supabaseSchemaStep: Step = {
  name: "supabase_schema",
  describe(_ctx: StepContext): string {
    return `Run template-dashboard/supabase_schema.sql against the new project (via Management API exec_sql)`;
  },
  async execute(_ctx: StepContext): Promise<void> {
    throw new NotYetImplementedError("supabase_schema");
  },
};
