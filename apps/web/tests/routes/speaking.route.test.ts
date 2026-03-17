// tests/routes/speaking.route.test.ts
//
// Smoke / integration tests for POST /api/speaking.
// Uses the injectable _handlePost export — no real OpenAI calls, no KV writes.
//
// Scenarios:
//   1. Scoring success + agent success → ok:true with full shape
//   2. Agent pipeline throws → ok:true with scoring data (graceful fallback)
//   3. Invalid request body → ok:false, 400

import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { _handlePost } from "@/app/api/speaking/_handler";
import type { SpeakingDeps } from "@/app/api/speaking/_handler";
import type { AgentContext, AgentPipelineResult } from "@/lib/agents/types";

// ── Stub helpers ──────────────────────────────────────────────────────────────

function makeReq(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const STUB_BAND = { overall: 6, content: 7, grammar: 6.5, vocab: 6, fluency: 4.5, pronunciation: 5.5 };

const STUB_PIPELINE_RESULT = {
  band: STUB_BAND,
  transcript: "This is my practice response for part two.",
  segments: [],
  speakingFeatures: { wpm: 115, pause_ratio: 0.2, avg_pause_sec: 0.8 },
  feedback: "Good structure overall.",
  suggestions: ["Vary sentence length.", "Improve intonation."],
  tokensUsed: 80,
  trace: {} as any,
  diagnosisResult: {
    anomalies: [] as any[],
    severity: "none" as const,
    engineConflict: false,
    lowConfidence: false,
  },
  debug: {
    exam_type: "speaking" as const,
    used_llm: true,
    used_local: false,
    debug_flags: {} as Record<string, boolean>,
    timings_ms: {},
    models: {} as any,
    calibration: {} as any,
  },
};

const STUB_BODY = {
  taskId: "test-s-001",
  prompt: "Describe a place you like to visit.",
  manualTranscript: "This is my practice response for part two.",
};

function makeStubDeps(overrides: Partial<SpeakingDeps> = {}): SpeakingDeps {
  return {
    pipeline: async () => STUB_PIPELINE_RESULT as any,
    agent: async (ctx: AgentContext): Promise<AgentPipelineResult> => {
      const { runAgentPipeline } = await import("@/lib/agents/orchestrator");
      return runAgentPipeline(ctx);
    },
    history: async () => [],
    save: async () => undefined as any,
    openaiClient: null as any,
    ...overrides,
  };
}

// ── Test 1: scoring success + agent success ───────────────────────────────────

test("speaking route: scoring + agent success returns ok:true with full shape", async () => {
  const res = await _handlePost(makeReq(STUB_BODY), makeStubDeps());
  const json = await res.json();

  assert.equal(json.ok, true, `expected ok:true, got: ${JSON.stringify(json)}`);
  assert.ok(json.data, "missing data field");

  // Core scoring fields
  assert.ok(json.data.band, "missing band");
  assert.equal(typeof json.data.band.overall, "number");
  assert.ok(typeof json.data.transcript === "string", "missing transcript");
  assert.ok(typeof json.data.feedback === "string", "missing feedback");
  assert.ok(Array.isArray(json.data.suggestions), "missing suggestions");

  // Speaking-specific shape
  assert.ok(json.data.content?.band, "missing content.band");
  assert.ok(json.data.speech?.band, "missing speech.band");
  assert.ok(json.data.speech?.metrics, "missing speech.metrics");

  // Agent output fields
  assert.ok(json.data.studyPlan, "missing studyPlan");
  assert.ok(Array.isArray(json.data.studyPlan.priorityDimensions), "studyPlan missing priorityDimensions");
  assert.ok(typeof json.data.studyPlan.nextTaskRecommendation === "string", "studyPlan missing nextTaskRecommendation");

  // agentMeta
  assert.ok(json.data.agentMeta, "missing agentMeta");
  assert.ok(typeof json.data.agentMeta.durationMs === "number");
  assert.ok(Array.isArray(json.data.agentMeta.agentsRan));
});

test("speaking route: studyPlan focuses on weakest speaking dimension (fluency=4.5)", async () => {
  const res = await _handlePost(makeReq(STUB_BODY), makeStubDeps());
  const json = await res.json();
  assert.equal(json.ok, true);
  // fluency=4.5 is furthest below overall=6
  assert.equal(
    json.data.studyPlan.priorityDimensions[0]?.dimension,
    "fluency",
    `expected fluency first, got ${json.data.studyPlan.priorityDimensions[0]?.dimension}`,
  );
});

test("speaking route: response includes requestId", async () => {
  const res = await _handlePost(makeReq(STUB_BODY), makeStubDeps());
  const json = await res.json();
  assert.ok(typeof json.requestId === "string" && json.requestId.length > 0, "missing requestId");
});

// ── Test 2: agent pipeline throws → API still returns scoring result ──────────

test("speaking route: agent pipeline throws → ok:true with scoring data preserved", async () => {
  const throwingAgent = async (): Promise<AgentPipelineResult> => {
    throw new Error("agent exploded");
  };

  const res = await _handlePost(
    makeReq(STUB_BODY),
    makeStubDeps({ agent: throwingAgent as any }),
  );
  const json = await res.json();

  assert.equal(json.ok, true, `expected ok:true, got: ${JSON.stringify(json)}`);

  // Scoring fields intact
  assert.ok(json.data.band, "band missing after agent failure");
  assert.equal(json.data.band.overall, 6);
  assert.equal(json.data.transcript, "This is my practice response for part two.");

  // studyPlan fallback has non-empty recommendation
  assert.ok(json.data.studyPlan, "studyPlan missing after agent failure");
  assert.ok(
    json.data.studyPlan.nextTaskRecommendation.length > 0,
    "fallback nextTaskRecommendation should not be empty",
  );
  assert.equal(
    json.data.studyPlan.nextTaskRecommendation,
    "speaking_part2_long_turn",
    "fallback should be 'speaking_part2_long_turn' for speaking",
  );
});

test("speaking route: agentMeta present and empty after agent failure", async () => {
  const throwingAgent = async (): Promise<AgentPipelineResult> => {
    throw new Error("agent exploded");
  };

  const res = await _handlePost(
    makeReq(STUB_BODY),
    makeStubDeps({ agent: throwingAgent as any }),
  );
  const json = await res.json();
  assert.ok(json.data.agentMeta, "agentMeta missing");
  assert.equal(json.data.agentMeta.durationMs, 0);
  assert.deepEqual(json.data.agentMeta.agentsRan, []);
});

// ── Test 3: invalid request body → 400 ───────────────────────────────────────

test("speaking route: missing taskId → ok:false, 400", async () => {
  const res = await _handlePost(
    makeReq({ prompt: "p", manualTranscript: "t" /* no taskId */ }),
    makeStubDeps(),
  );
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(res.status, 400);
  assert.ok(json.error?.code, "missing error.code");
});

test("speaking route: empty taskId → ok:false, 400", async () => {
  const res = await _handlePost(
    makeReq({ taskId: "" }),
    makeStubDeps(),
  );
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(res.status, 400);
});

test("speaking route: non-JSON body → ok:false, 400", async () => {
  const badReq = { json: async () => { throw new SyntaxError("bad json"); } } as unknown as NextRequest;
  const res = await _handlePost(badReq, makeStubDeps());
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(res.status, 400);
});
