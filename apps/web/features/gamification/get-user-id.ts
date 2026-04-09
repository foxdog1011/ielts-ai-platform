// features/gamification/get-user-id.ts
//
// Extracts a user identifier from request headers.
// Uses auth session userId when available, falls back to IP-based ID.
// Will be replaced with proper auth once auth system is ready.

import { headers } from "next/headers";

export async function getUserId(): Promise<string> {
  const h = await headers();
  // Prefer forwarded IP for anonymous users
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "anonymous";
  return `ip:${ip}`;
}

export function getUserIdFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "anonymous";
  return `ip:${ip}`;
}
