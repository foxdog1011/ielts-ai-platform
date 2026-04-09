// app/auth/signin/page.tsx
//
// Custom sign-in page with Google OAuth + Email/Password.

"use client";

import { signIn } from "next-auth/react";
import { useState, useCallback, type FormEvent } from "react";

type Mode = "signin" | "register";

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCredentials = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        if (mode === "register") {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data?.error?.message ?? "Registration failed");
            setLoading(false);
            return;
          }
        }

        // Sign in (works for both modes — after register we auto-login)
        // signIn with redirect:false returns SignInResponse | undefined
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl: "/",
        });

        if (result && typeof result === "object" && "error" in result && result.error) {
          setError("Invalid email or password");
        } else {
          // Successful — redirect manually
          window.location.href = "/";
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, name],
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f6f3] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center shadow-sm">
            <span className="text-white text-[12px] font-bold">AI</span>
          </div>
          <span className="text-[18px] font-semibold tracking-tight text-zinc-900">
            IELTS AI
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <h1 className="text-[16px] font-semibold text-zinc-900 text-center mb-5">
            {mode === "signin" ? "Sign in to your account" : "Create an account"}
          </h1>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50 transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-[11px] text-zinc-400">or</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleCredentials} className="space-y-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />

            {error && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading
                ? "..."
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="mt-4 text-center text-[12px] text-zinc-500">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        {/* Freemium hint */}
        <p className="mt-4 text-center text-[11px] text-zinc-400">
          You can try Writing and Speaking without an account.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
