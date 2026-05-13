import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  seedAll,
  seedCategories,
  seedLocations,
  seedStatuses,
  type SeedInputs,
} from "../lib/seed-core.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

interface UpsertCall {
  table: string;
  rows: unknown[];
  opts: { onConflict: string };
}

function mockClient(): { client: SupabaseClient; calls: UpsertCall[] } {
  const calls: UpsertCall[] = [];
  const client = {
    from(table: string) {
      return {
        upsert: (rows: unknown[], opts: { onConflict: string }) => {
          calls.push({ table, rows, opts });
          return Promise.resolve({ error: null, data: rows });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const silentLogger = { info: (_: string) => {} };

test("seedCategories: upserts on `name` conflict", async () => {
  const { client, calls } = mockClient();
  await seedCategories(client, ["A", "B"], silentLogger);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "categories");
  assert.equal(calls[0].opts.onConflict, "name");
  assert.deepEqual(calls[0].rows, [{ name: "A" }, { name: "B" }]);
});

test("seedCategories: no-op when list is empty", async () => {
  const { client, calls } = mockClient();
  await seedCategories(client, [], silentLogger);
  assert.equal(calls.length, 0);
});

test("seedStatuses: defaults sort_order when missing, upserts on `key`", async () => {
  const { client, calls } = mockClient();
  await seedStatuses(
    client,
    [
      { key: "on_rent", name: "On Rent", color: "#22c55e", behavior: "rented" },
      { key: "available", name: "Available", color: "#3b82f6", behavior: "available", sort_order: 25 },
    ],
    silentLogger
  );
  assert.equal(calls[0].table, "statuses");
  assert.equal(calls[0].opts.onConflict, "key");
  const rows = calls[0].rows as Array<{ key: string; sort_order: number }>;
  assert.equal(rows[0].sort_order, 10); // default: (i+1)*10
  assert.equal(rows[1].sort_order, 25); // preserved
});

test("seedLocations: defaults nullable coords/address to null", async () => {
  const { client, calls } = mockClient();
  await seedLocations(
    client,
    [{ name: "Yard A" }, { name: "Yard B", latitude: 32.7, longitude: -96.8 }],
    silentLogger
  );
  const rows = calls[0].rows as Array<Record<string, unknown>>;
  assert.equal(rows[0].address, null);
  assert.equal(rows[0].latitude, null);
  assert.equal(rows[1].latitude, 32.7);
});

test("seedAll: runs categories, statuses, locations in that order", async () => {
  const { client, calls } = mockClient();
  const inputs: SeedInputs = {
    categories: ["A"],
    statuses: [{ key: "k", name: "n", color: "#000000", behavior: "available" }],
    locations: [{ name: "L" }],
  };
  await seedAll(client, inputs, silentLogger);
  assert.deepEqual(
    calls.map((c) => c.table),
    ["categories", "statuses", "locations"]
  );
});

test("seedCategories: throws on Supabase error", async () => {
  const failingClient = {
    from() {
      return {
        upsert: () => Promise.resolve({ error: { message: "permission denied" } }),
      };
    },
  } as unknown as SupabaseClient;
  await assert.rejects(
    () => seedCategories(failingClient, ["A"], silentLogger),
    /permission denied/
  );
});
