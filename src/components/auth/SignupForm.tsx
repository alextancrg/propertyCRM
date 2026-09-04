"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Self-service signup. Creates an unverified account and emails a
 * verification link — the user must click it before logging in.
 */
export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, birthDate, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not create your account. Please try again.");
      // Show the "check your inbox" confirmation with the email used.
      router.push(`/signup/check-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary text-white">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-2xl">
              <i className="fa-solid fa-building-user" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-sm text-blue-300">Sign up with your email to start managing properties.</p>
          </div>

          <form onSubmit={submit} className="card bg-white p-6 text-slate-900 shadow-2xl">
            <div className="grid gap-4">
              <div>
                <label className="label mb-1">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label className="label mb-1">Email (used to log in)</label>
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
                <label className="label mb-1">Phone (optional)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="01x-xxx-xxxx"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="label mb-1">
                  Birthdate <span className="normal-case text-slate-400">(for password-reset identity check)</span>
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="input cursor-pointer"
                  autoComplete="bday"
                  required
                />
              </div>
              <div>
                <label className="label mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="label mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              {error && <p className="text-sm font-medium text-red-500">{error}</p>}

              <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" /> Creating account…
                  </>
                ) : (
                  "Sign up"
                )}
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-blue-200/80">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-white underline underline-offset-2">
              Log in
            </Link>
          </p>
          <p className="mt-3 text-center text-xs">
            <Link
              href="/privacy-policy"
              className="text-blue-200/80 underline underline-offset-2 transition hover:text-white"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
