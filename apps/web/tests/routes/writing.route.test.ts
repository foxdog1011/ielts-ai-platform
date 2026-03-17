// tests/routes/writing.route.test.ts
//
// Smoke / integration tests for POST /api/writing.
// Uses the injectable _handlePost export — no real OpenAI calls, no KV writes.
//
// Scenarios:
//   1. Scoring success + agent success → ok:true with full shape
//   2. Agent pipeline throws → ok:true with scoring data (graceful fallback)
//   3. Invalid request body → ok:false, 400

import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { _handlePost } from "@/app/api/writing/_handler";
import type { WritingDeps } from "@/app/api/writing/_handler";
import type { AgentContext, AgentPipelineResult } from "@/lib/agents/types";

// ── Stub helpers ──────────────────────────────────────────────────────────────

function makeReq(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const STUB_BAND = { overall: 6.5, taskResponse: 7, coherence: 6.5, lexical: 5, grammar: 6.5 };

const STUB_PIPELINE_RESULT = {
  band: STUB_BAND,
  paragraphFeedback: [{ index: 0, comment: "clear" }],
  improvements: ["Expand vocabulary range."],
  rewritten: "Improved essay.",
  tokensUsed: 100,
  words: 250,
  trace: {} as any,
  diagnosisResult: {
    anomalies: [] as any[],
    severity: "none" as const,
    engineConflict: false,
    lowConfidence: false,
  },
  debug: {
    exam_type: "writing" as const,
    used_llm: true,
    used_local: false,
    debug_flags: {} as Record<string, boolean>,
    timings_ms: {},
    models: {} as any,
    calibration: {} as any,
  },
};

const STUB_BODY = {
  taskId: "test-w-001",
  taskType: "task2" as const,
  prompt: "Discuss both views.",
  essay: "This is a test essay. ".repeat(30),
};

function makeStubDeps(overrides: Partial<WritingDeps> = {}): WritingDeps {
  return {
    pipeline: async () => STUB_PIPELINE_RESULT as any,
    agent: async (ctx: AgentContext): Promise<AgentPipelineResult> => {
      // Real agent pipeline with stub context (deterministic, no LLM)
      const { runAgentPipeline } = await import("@/lib/agents/orchestrator");
      return runAgentPipeline(ctx);
    },
    history: async () => [],
    save: async () => undefined as any,
    openaiClient: null as any,  // prevents getOpenAIClient() from being called
    ...overrides,
  };
}

// ── Test 1: scoring success + agent success ───────────────────────────────────

test("writing route: scoring + agent success returns ok:true with full shape", async () => {
  const res = await _handlePost(makeReq(STUB_BODY), makeStubDeps());
  const json = await res.json();

  assert.equal(json.ok, true, `expected ok:true, got: ${JSON.stringify(json)}`);
  assert.ok(json.data, "missing data field");

  // Core scoring fields
  assert.ok(json.data.band, "missing band");
  assert.equal(typeof json.data.band.overall, "number");
  assert.ok(Array.isArray(json.data.paragraphFeedback), "missing paragraphFeedback");
  assert.ok(Array.isArray(json.data.improvements), "missing improvements");

  // Agent output fields
  assert.ok(json.data.studyPlan, "missing studyPlan");
  assert.ok(Array.isArray(json.data.studyPlan.priorityDimensions), "studyPlan missing priorityDimensions");
  assert.ok(typeof json.data.studyPlan.nextTaskRecommendation === "string", "studyPlan missing nextTaskRecommendation");
  assert.ok(typeof json.data.studyPlan.milestoneBand === "number", "studyPlan missing milestoneBand");

  // agentMeta
  assert.ok(json.data.agentMeta, "missing agentMeta");
  assert.ok(typeof json.data.agentMeta.durationMs === "number", "agentMeta missing durationMs");
  assert.ok(Array.isArray(json.data.agentMeta.agentsRan), "agentMeta missing agentsRan");
});

test("writing route: agentMeta.agentsRan contains all three agents", async () => {
  const res = await _handlePost(makeReq(STUB_BODY), makeStubDeps());
  const json = await res.json();
  const ran: string[] = json.data.agentMeta.agentsRan;
  assert.ok(ran.includes("DiagnosisAgent"), `DiagnosisAgent not in agentsRan: ${ran}`);
  assert.ok(ran.includes("PlannerAgent"), `PlannerAgent not in agentsRan: ${ran}`);
  assert.ok(ran.includes("ReviewerAgent"), `ReviewerAgent not in agentsRan: ${ran}`);
});

test("writing route: coachSnapshot has expected shape when present", async () => {
  const res = await _handlePost(makeReq(STUB_BODY), makeStubDeps());
  const json = await res.json();
  if (json.data.coachSnapshot) {
    assert.ok("learnerProfile" in json.data.coachSnapshot, "coachSnapshot missing learnerProfile");
    assert.ok("coachSummary" in json.data.coachSnapshot, "coachSnapshot missing coachSummary");
    assert.ok("nextActionCandidate" in json.data.coachSnapshot, "coachSnapshot missing nextActionCandidate");
    assert.ok("weeklySummaryPreview" in json.data.coachSnapshot, "coachSnapshot missing weeklySummaryPreview");
  }
  // coachSnapshot being undefined is also acceptable (first session)
});

// ── Test 2: agent pipeline throws → API still returns scoring result ──────────

test("writing route: agent pipeline throws → ok:true with scoring data preserved", async () => {
  const throwingAgent = async (): Promise<AgentPipelineResult> => {
    throw new Error("agent exploded");
  };

  const res = await _handlePost(
    makeReq(STUB_BODY),
    makeStubDeps({ agent: throwingAgent as any }),
  );
  const json = await res.json();

  // Route must still return ok:true — scoring data must not be lost
  assert.equal(json.ok, true, `expected ok:true, got: ${JSON.stringify(json)}`);

  // Scoring fields are present
  assert.ok(json.data.band, "band missing after agent failure");
  assert.equal(json.data.band.overall, 6.5);
  assert.ok(Array.isArray(json.data.improvements), "improvements missing after agent failure");

  // studyPlan should be the fallback (non-empty nextTaskRecommendation)
  assert.ok(json.data.studyPlan, "studyPlan missing after agent failure");
  assert.ok(
    json.data.studyPlan.nextTaskRecommendation.length > 0,
    "fallback studyPlan.nextTaskRecommendation should not be empty",
  );
  assert.equal(
    json.data.studyPlan.nextTaskRecommendation,
    "task2_argument",
    "fallback should be 'task2_argument' for writing",
  );
});

test("writing route: agentMeta is present even after agent pipeline failure", async () => {
  const throwingAgent = async (): Promise<AgentPipelineResult> => {
    throw new Error("agent exploded");
  };

  const res = await _handlePost(
    makeReq(STUB_BODY),
    makeStubDeps({ agent: throwingAgent as any }),
  );
  const json = await res.json();
  assert.ok(json.data.agentMeta, "agentMeta missing after agent failure");
  assert.equal(json.data.agentMeta.durationMs, 0);
  assert.deepEqual(json.data.agentMeta.agentsRan, []);
});

// ── Test 3: invalid request body → 400 ───────────────────────────────────────

test("writing route: missing essay → ok:false, 400", async () => {
  const res = await _handlePost(makeReq({ taskId: "x", prompt: "p" /* no essay */ }), makeStubDeps());
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(res.status, 400);
  assert.ok(json.error?.code, "missing error.code");
});

test("writing route: empty taskId → ok:false, 400", async () => {
  const res = await _handlePost(
    makeReq({ taskId: "", prompt: "p", essay: "e".repeat(50) }),
    makeStubDeps(),
  );
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(res.status, 400);
});

test("writing route: non-JSON body → ok:false, 400", async () => {
  const badReq = { json: async () => { throw new SyntaxError("bad json"); } } as unknown as NextRequest;
  const res = await _handlePost(badReq, makeStubDeps());
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(res.status, 400);
});
