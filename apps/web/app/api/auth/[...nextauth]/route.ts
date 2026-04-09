// app/api/auth/[...nextauth]/route.ts
//
// NextAuth v5 App Router catch-all route handler.

import { handlers } from "@/features/auth/auth";

export const { GET, POST } = handlers;
