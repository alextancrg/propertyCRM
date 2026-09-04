"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not reset your password. Please try again.");
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password. Please try again.");
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <Shell>
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" />
          This page needs a valid reset link from your email. Request a new one from the{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            forgot password
          </Link>{" "}
          page.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {done ? (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
          <i className="fa-solid fa-circle-check mr-1.5" />
          Password updated. Redirecting you to login…
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <div>
            <label className="label mb-1">New password</label>
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
            <label className="label mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs font-medium text-red-500">Passwords do not match.</p>
            )}
          </div>
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" /> Updating…
              </>
            ) : (
              "Reset password"
            )}
          </button>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-2xl">
              <i className="fa-solid fa-lock-open" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Choose a new password</h1>
            <p className="text-sm text-blue-300">Enter your new password twice to confirm.</p>
          </div>
          <div className="card bg-white p-6 text-slate-900 shadow-2xl">{children}</div>
          <p className="mt-4 text-center text-xs text-blue-200/80">
            <Link href="/login" className="font-semibold text-white underline underline-offset-2">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
