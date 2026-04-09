// features/auth/user-store.ts
//
// KV-backed user storage for Credentials provider.
// Stores user records keyed by email in Vercel KV.
//
// Password hashing uses the Web Crypto API (SubtleCrypto)
// which is available in both Node.js and Edge runtimes.

import { kvSetJSON, kvGetJSON } from "@/shared/infrastructure/kv";

interface StoredUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly salt: string;
  readonly createdAt: string;
}

/** Minimal user object returned to NextAuth (no password fields). */
interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

function userKey(email: string): string {
  return `user:email:${email.toLowerCase().trim()}`;
}

// ---------- Crypto helpers (Web Crypto API) ----------

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Public API ----------

/**
 * Verify email + password against stored hash.
 * Returns the user if valid, null otherwise.
 */
export async function verifyUser(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const stored = await kvGetJSON<StoredUser>(userKey(email));
  if (!stored) return null;

  const hash = await hashPassword(password, stored.salt);
  if (hash !== stored.passwordHash) return null;

  return { id: stored.id, email: stored.email, name: stored.name };
}

/**
 * Create a new user with email + password.
 * Returns the user on success, null if email already taken.
 */
export async function createUser(
  email: string,
  password: string,
  name: string,
): Promise<AuthUser | null> {
  const existing = await kvGetJSON<StoredUser>(userKey(email));
  if (existing) return null;

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const id = generateId();

  const record: StoredUser = {
    id,
    email: email.toLowerCase().trim(),
    name,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  await kvSetJSON(userKey(email), record);
  return { id, email: record.email, name };
}
