import { strict as assert } from "node:assert";
import { test } from "node:test";
import { supabaseSeedStep } from "../lib/steps/supabase_seed.ts";
import { makeContext } from "./helpers/context.ts";

test("supabase_seed: fails fast if supabase_create state is missing", async () => {
  const ctx = makeContext();
  await assert.rejects(
    () => supabaseSeedStep.execute(ctx),
    /supabase_create must complete first/
  );
});

test("supabase_seed: fails fast if service_role_key is empty", async () => {
  const ctx = makeContext();
  ctx.state.steps.supabase_create = {
    project_ref: "ref",
    db_password: "pw",
    supabase_url: "https://ref.supabase.co",
    anon_key: "anon",
    service_role_key: "", // partial state — wait/keys hasn't completed yet
    completed_at: "",
  };
  await assert.rejects(
    () => supabaseSeedStep.execute(ctx),
    /missing service_role_key/
  );
});
