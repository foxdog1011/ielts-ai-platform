/**
 * lib/openai.ts
 *
 * Single OpenAI client factory for the entire app.
 *
 * Rules:
 *  - Validates OPENAI_API_KEY at call time (not import time) so Next.js
 *    build/static analysis never sees a missing-key error.
 *  - Returns a module-level singleton so all callers within one Node.js
 *    process share the same instance (connection pool reuse).
 *  - Never hard-codes or exposes the key; always reads from process.env.
 *  - Throws a descriptive Error (not the SDK's buried internal message)
 *    when the env var is absent, so the 400 response body is readable.
 */

import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let _client: OpenAI | undefined;
let _envFallbackDisabled = false;

/**
 * Fallback: manually load .env.local if Next.js @next/env failed to inject it.
 * This happens in certain monorepo setups where Next.js silently skips loading.
 */
function loadEnvLocalFallback() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && val && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // ignore — file may not exist in production
  }
}

/**
 * Returns the shared OpenAI client.
 * Throws `Error("OPENAI_API_KEY is not set …")` when the env var is missing
 * so callers can surface a clear error to the user.
 *
 * Safe to call from route handlers, server actions, and pipeline functions.
 * Never call from module top-level (e.g. as a default export value) because
 * Next.js evaluates modules at build time before env vars are injected.
 */
export function getOpenAIClient(): OpenAI {
  if (_client) return _client;
  if (!process.env.OPENAI_API_KEY && !_envFallbackDisabled) loadEnvLocalFallback();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. " +
        "Add it to apps/web/.env.local for local development, " +
        "or set it in your deployment environment (Vercel → Settings → Environment Variables)."
    );
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

/** Reset singleton — test use only. */
export function _resetOpenAIClientForTest(): void {
  _client = undefined;
}

/** Disable .env.local fallback — test use only. Call once at start of test, restore after. */
export function _disableEnvFallbackForTest(disabled: boolean): void {
  _envFallbackDisabled = disabled;
}
