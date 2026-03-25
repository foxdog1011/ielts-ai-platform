/**
 * Next.js Edge Middleware — rate limiting for expensive AI endpoints.
 *
 * Limits each IP to LIMIT POST requests per WINDOW_SECONDS on
 * /api/writing, /api/speaking, and /api/upload-audio.
 *
 * Counter is stored in Vercel KV when available; silently skipped
 * (allow-through) if KV is not configured (local dev / no KV plan).
 */
import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const LIMIT = 10;            // max requests per IP per window
const WINDOW_SEC = 3600;     // 1 hour

const HAS_KV =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

export async function middleware(req: NextRequest) {
  // Only gate POST requests on the expensive AI routes
  if (req.method !== "POST") return NextResponse.next();

  if (!HAS_KV) return NextResponse.next(); // KV not configured — allow through

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const key = `rl:${req.nextUrl.pathname}:${ip}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, WINDOW_SEC);

    if (count > LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: `Rate limit exceeded. Max ${LIMIT} submissions per hour per IP.`,
          },
        },
        { status: 429 },
      );
    }
  } catch {
    // KV error — fail open (don't block legitimate users)
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/writing", "/api/speaking", "/api/upload-audio"],
};
