"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Forgot password — step 1: verify identity with email + birthdate. On a
 * match, a reset link (24h expiry) is emailed. The response is the same
 * whether or not the details matched, so the form can't probe accounts.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, birthDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not process your request. Please try again.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process your request. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-2xl">
              <i className="fa-solid fa-key" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Forgot password</h1>
            <p className="text-sm text-blue-300">Verify your identity to receive a reset link.</p>
          </div>

          <form onSubmit={submit} className="card bg-white p-6 text-slate-900 shadow-2xl">
            <div className="grid gap-4">
              <div>
                <label className="label mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="label mb-1">Birthdate</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="input cursor-pointer"
                  autoComplete="bday"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  We use your registered birthdate to confirm it&apos;s really you.
                </p>
              </div>

              {error && <p className="text-sm font-medium text-red-500">{error}</p>}

              {done ? (
                <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                  <i className="fa-solid fa-circle-check mr-1.5" />
                  If your email and birthdate match our records, a password reset link has been sent
                  to your email. The link expires in <b>24 hours</b>.
                </div>
              ) : (
                <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
                  {saving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" /> Verifying…
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </button>
              )}
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-blue-200/80">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-white underline underline-offset-2">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
