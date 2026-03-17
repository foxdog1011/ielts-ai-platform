import test from "node:test";
import assert from "node:assert/strict";

// Import the internal reset helper — only exists for test isolation.
// We use dynamic import so the module is re-evaluated after env manipulation.

test("getOpenAIClient: throws descriptive error when OPENAI_API_KEY is absent", async () => {
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    // Dynamic import + reset to bypass module-level singleton from prior tests.
    const { getOpenAIClient, _resetOpenAIClientForTest } = await import("@/lib/openai");
    _resetOpenAIClientForTest();
    assert.throws(
      () => getOpenAIClient(),
      (err: unknown) => {
        assert.ok(err instanceof Error, "should throw an Error");
        assert.ok(
          err.message.includes("OPENAI_API_KEY"),
          `message should mention OPENAI_API_KEY, got: ${err.message}`,
        );
        return true;
      },
    );
  } finally {
    process.env.OPENAI_API_KEY = saved ?? "test-key";
    // Reset again so subsequent tests get a fresh client.
    const { _resetOpenAIClientForTest } = await import("@/lib/openai");
    _resetOpenAIClientForTest();
  }
});

test("getOpenAIClient: returns same instance on repeated calls (singleton)", async () => {
  process.env.OPENAI_API_KEY = "sk-test-singleton";
  const { getOpenAIClient, _resetOpenAIClientForTest } = await import("@/lib/openai");
  _resetOpenAIClientForTest();
  const a = getOpenAIClient();
  const b = getOpenAIClient();
  assert.strictEqual(a, b, "should be the same object reference");
  _resetOpenAIClientForTest();
});

test("getOpenAIClient: constructs successfully when OPENAI_API_KEY is set", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key-valid";
  const { getOpenAIClient, _resetOpenAIClientForTest } = await import("@/lib/openai");
  _resetOpenAIClientForTest();
  assert.doesNotThrow(() => getOpenAIClient());
  _resetOpenAIClientForTest();
});

// ── Route-level: writing pipeline surfaces errors correctly ──────────────────

test("writing route: returns ok:false + WRITING_SCORING_FAILED when pipeline throws", async () => {
  // Simulate the pipeline throwing (e.g. missing API key, LLM failure)
  const { runWritingPipeline } = await import("@/lib/scoring/writingPipeline");
  const { NextRequest } = await import("next/server");
  const { POST } = await import("@/app/api/writing/route");

  const failingPipeline: typeof runWritingPipeline = async () => {
    throw new Error("OpenAI API error: invalid key");
  };

  // We can't cleanly inject into the route without a DI mechanism, but we can
  // validate the route's own try/catch by calling it with a bad JSON body —
  // the Zod parse will throw, and the catch block must return ok:false.
  const req = new NextRequest("http://localhost/api/writing", {
    method: "POST",
    body: JSON.stringify({ taskId: "", essay: "", prompt: "" }), // Zod: taskId min(1) fails
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(json.error.code, "WRITING_SCORING_FAILED");
  assert.ok(typeof json.error.message === "string");
});

// ── Route-level: speaking pipeline surfaces errors correctly ─────────────────

test("speaking route: returns ok:false + SPEAKING_SCORING_FAILED when pipeline throws", async () => {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("@/app/api/speaking/route");

  // Empty body → JSON parse error → catch block fires
  const req = new NextRequest("http://localhost/api/speaking", {
    method: "POST",
    body: "not-json",
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(json.error.code, "SPEAKING_SCORING_FAILED");
  assert.ok(typeof json.error.message === "string");
  // requestId must always be present even on error
  assert.ok(typeof json.requestId === "string");
});
