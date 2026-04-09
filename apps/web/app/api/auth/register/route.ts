// app/api/auth/register/route.ts
//
// Registration endpoint for email/password users.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser } from "@/features/auth/user-store";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join("; "),
          },
        },
        { status: 400 },
      );
    }

    const user = await createUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name,
    );

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "EMAIL_TAKEN",
            message: "An account with this email already exists.",
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, data: { id: user.id, email: user.email } });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Registration failed. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
