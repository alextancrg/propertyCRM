"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? t("login.failed"));
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.couldNotLogin"));
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
              <i className="fa-solid fa-building-user" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">AssetHub</h1>
            <p className="text-sm text-blue-300">{t("login.subtitle")}</p>
          </div>

          <form onSubmit={submit} className="card bg-white p-6 text-slate-900 shadow-2xl">
            <div className="grid gap-4">
              <div>
                <label className="label mb-1">{t("login.email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="admin@assethub.my"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="label mb-1">{t("login.password")}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && <p className="text-sm font-medium text-red-500">{error}</p>}

              <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
                {saving ? <><i className="fa-solid fa-spinner fa-spin" /> {t("login.signingIn")}</> : t("login.signIn")}
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-blue-200/70">{t("login.registerHint")}</p>
          <p className="mt-3 text-center text-xs">
            <Link
              href="/privacy-policy"
              className="text-blue-200/80 underline underline-offset-2 transition hover:text-white"
            >
              {t("app.privacyPolicy")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
