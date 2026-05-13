import { strict as assert } from "node:assert";
import { test } from "node:test";
import { supabaseSchemaStep } from "../lib/steps/supabase_schema.ts";
import { makeContext } from "./helpers/context.ts";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";

test("supabase_schema: POSTs SQL to /database/query and marks complete", async () => {
  const ctx = makeContext();
  ctx.state.steps.supabase_create = {
    project_ref: "abcref",
    db_password: "x".repeat(24),
    supabase_url: "https://abcref.supabase.co",
    anon_key: "anon",
    service_role_key: "service",
    completed_at: new Date().toISOString(),
  };

  const mock = new FetchMock();
  mock.expect(
    "POST",
    "https://api.supabase.com/v1/projects/abcref/database/query",
    { status: 200, body: { result: [] } },
    (body) => {
      const b = body as { query: string };
      // We don't pin to the exact schema content — just that it looks
      // like our schema (mentions one of our tables).
      assert.ok(b.query.includes("equipment") || b.query.includes("categories"));
    }
  );

  await withMockedFetch(mock, () => supabaseSchemaStep.execute(ctx));
  mock.assertAllConsumed();
  assert.ok(ctx.state.steps.supabase_schema?.completed_at);
});

test("supabase_schema: fails fast if supabase_create has not completed", async () => {
  const ctx = makeContext();
  // No supabase_create in state
  await assert.rejects(
    () => supabaseSchemaStep.execute(ctx),
    /supabase_create must complete first/
  );
});
