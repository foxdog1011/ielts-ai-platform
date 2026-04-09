/**
 * Next.js Edge Middleware — authentication + rate limiting.
 *
 * 1. Auth: Uses NextAuth v5's authorized callback (in auth.config.ts)
 *    to protect routes. Public/freemium routes are accessible without login.
 *
 * 2. Rate limiting: Limits POST requests on expensive AI endpoints.
 *    Authenticated users get higher limits than anonymous users.
 *
 * Counter is stored in Vercel KV when available; silently skipped
 * (allow-through) if KV is not configured (local dev / no KV plan).
 */
import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/features/auth/auth.config";
import { RATE_LIMIT_TIERS } from "@/features/auth/types";
import { kv } from "@vercel/kv";

const { auth } = NextAuth(authConfig);

const HAS_KV =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

/** Paths that trigger rate limiting on POST. */
const RATE_LIMITED_PATHS = ["/api/writing", "/api/speaking", "/api/upload-audio"];

function isRateLimitedPath(pathname: string): boolean {
  return RATE_LIMITED_PATHS.some((p) => pathname.startsWith(p));
}

async function applyRateLimit(
  req: NextRequest,
  userId: string | undefined,
): Promise<NextResponse | null> {
  if (req.method !== "POST") return null;
  if (!isRateLimitedPath(req.nextUrl.pathname)) return null;
  if (!HAS_KV) return null;

  const tier = userId
    ? RATE_LIMIT_TIERS.authenticated
    : RATE_LIMIT_TIERS.anonymous;

  const identity = userId
    ? `user:${userId}`
    : (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown");

  const key = `rl:${req.nextUrl.pathname}:${identity}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, tier.windowSeconds);

    if (count > tier.maxRequests) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: `Rate limit exceeded. Max ${tier.maxRequests} submissions per hour.${
              !userId ? " Sign in for higher limits." : ""
            }`,
          },
        },
        { status: 429 },
      );
    }
  } catch {
    // KV error — fail open (don't block legitimate users)
  }

  return null;
}

export default auth(async function middleware(req) {
  // Rate limiting (runs after auth so we know if user is authenticated)
  const session = (req as any).auth;
  const userId: string | undefined = session?.user?.id;

  const rateLimitResponse = await applyRateLimit(req, userId);
  if (rateLimitResponse) return rateLimitResponse;

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
