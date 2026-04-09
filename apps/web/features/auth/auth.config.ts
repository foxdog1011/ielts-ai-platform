// features/auth/auth.config.ts
//
// Auth.js (NextAuth v5) configuration — providers and callbacks.
// Separated from auth.ts so middleware can import a lightweight config
// without pulling in adapter/database dependencies.

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

/**
 * Credential login schema — validated at the boundary.
 * Passwords are verified against hashed values stored in KV.
 */
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Delegate to a KV-backed user lookup.
        // This is intentionally lazy-imported to keep auth.config.ts
        // free of heavy dependencies (important for Edge middleware).
        const { verifyUser } = await import("./user-store");
        const user = await verifyUser(parsed.data.email, parsed.data.password);
        return user;
      },
    }),
  ],

  pages: {
    signIn: "/auth/signin",
  },

  callbacks: {
    /** Attach user id to the JWT so it's available in the session. */
    jwt({ token, user }) {
      if (user?.id) {
        return { ...token, id: user.id };
      }
      return token;
    },

    /** Expose user id on the client-side session object. */
    session({ session, token }) {
      if (token.id && typeof token.id === "string") {
        return {
          ...session,
          user: { ...session.user, id: token.id },
        };
      }
      return session;
    },

    /**
     * Control which routes require authentication.
     * Returning true allows access; returning false redirects to sign-in.
     */
    authorized({ auth: session, request: { nextUrl } }) {
      const isAuthenticated = !!session?.user;
      const { pathname } = nextUrl;

      // Public pages — always accessible (freemium demo)
      const publicPaths = [
        "/",
        "/auth/signin",
        "/api/auth",
      ];
      const publicPrefixes = [
        "/tasks/",          // writing & speaking demo
        "/api/auth/",       // auth API routes
      ];

      const isPublic =
        publicPaths.includes(pathname) ||
        publicPrefixes.some((prefix) => pathname.startsWith(prefix));

      if (isPublic) return true;

      // API routes for writing/speaking — allow unauthenticated
      // (rate-limited separately in middleware)
      const openApiPrefixes = ["/api/writing", "/api/speaking", "/api/upload-audio"];
      if (openApiPrefixes.some((p) => pathname.startsWith(p))) return true;

      // Everything else requires auth
      return isAuthenticated;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

export default authConfig;
