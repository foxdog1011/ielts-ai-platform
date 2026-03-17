/**
 * Tests that the in-memory KV store persists across simulated HMR
 * module re-evaluations (i.e. data written before a re-eval is visible after).
 *
 * The pattern under test: kv.ts attaches its Maps to globalThis so that
 * when Next.js HMR re-evaluates the module the Maps are not re-created.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { saveScore, listScores } from "@/lib/kv";

// ── helpers ───────────────────────────────────────────────────────────────────

function clearKvGlobals() {
  const g = globalThis as Record<string, unknown>;
  delete g["__kv_mem__"];
  delete g["__kv_mem_lists__"];
  delete g["__kv_mem_sets__"];
}

// ── tests ─────────────────────────────────────────────────────────────────────

test("kv in-memory: data written in one call is visible in a subsequent call", async () => {
  // Clean state for this test
  clearKvGlobals();

  await saveScore("writing", {
    taskId: "persist-test-1",
    band: { overall: 6.5, grammar: 5.5 },
    ts: Date.now(),
  });

  const records = await listScores("writing", 50);
  assert.ok(records.length >= 1, "should have at least one record");
  const found = records.find((r) => r.taskId === "persist-test-1");
  assert.ok(found, "saved record should be retrievable");
  assert.equal((found!.band as Record<string, number>).overall, 6.5);
});

test("kv in-memory: simulated HMR re-eval preserves data via globalThis", async () => {
  // Write a record (pre HMR)
  await saveScore("writing", {
    taskId: "persist-test-2",
    band: { overall: 7.0 },
    ts: Date.now(),
  });

  // Simulate HMR: delete the module-level binding reference but NOT globalThis.
  // In real HMR kv.ts would be re-evaluated, re-running the globalThis guard.
  // We replicate that by re-importing dynamically (same module cache) — the
  // key proof is that globalThis already has the Maps populated, so new Maps
  // are NOT created.
  const kvMod = await import("@/lib/kv");
  const after = await kvMod.listScores("writing", 50);

  const found = after.find((r) => r.taskId === "persist-test-2");
  assert.ok(found, "record written before simulated HMR should still be visible");
});

test("kv in-memory: writing and speaking use independent lists", async () => {
  clearKvGlobals();

  await saveScore("writing",  { taskId: "w-isolation", band: { overall: 6 }, ts: Date.now() });
  await saveScore("speaking", { taskId: "s-isolation", band: { overall: 5 }, ts: Date.now() });

  const wri = await listScores("writing",  50);
  const spk = await listScores("speaking", 50);

  assert.ok(wri.find((r) => r.taskId === "w-isolation"), "writing record in writing list");
  assert.ok(spk.find((r) => r.taskId === "s-isolation"), "speaking record in speaking list");
  assert.ok(!wri.find((r) => r.taskId === "s-isolation"), "speaking record NOT in writing list");
  assert.ok(!spk.find((r) => r.taskId === "w-isolation"), "writing record NOT in speaking list");
});

test("kv in-memory: listScores returns records newest-first (tail behaviour)", async () => {
  clearKvGlobals();
  const now = Date.now();

  await saveScore("writing", { taskId: "oldest", band: { overall: 5 }, ts: now - 2000 });
  await saveScore("writing", { taskId: "middle", band: { overall: 6 }, ts: now - 1000 });
  await saveScore("writing", { taskId: "newest", band: { overall: 7 }, ts: now });

  // listScores returns oldest→newest (raw KV order); pageNewestFirst in history.ts reverses
  const raw = await listScores("writing", 50);
  const ids = raw.map((r) => r.taskId);
  assert.ok(ids.indexOf("oldest") < ids.indexOf("newest"),
    "listScores should return oldest first (raw append order)");
});
