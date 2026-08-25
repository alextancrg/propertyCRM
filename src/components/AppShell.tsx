"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { RouteProgress } from "@/components/RouteProgress";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "fa-chart-pie" },
  { href: "/managers", label: "Profiles", icon: "fa-user-gear" },
  { href: "/owners", label: "Owners", icon: "fa-users" },
  { href: "/properties", label: "Properties & Leases", icon: "fa-house" },
  { href: "/bills", label: "Bills & Utilities", icon: "fa-list-check" },
  { href: "/rentals", label: "Rental Collection", icon: "fa-hand-holding-dollar" },
  { href: "/tax", label: "Tax & Audit", icon: "fa-file-invoice-dollar" },
  { href: "/documents", label: "Documents", icon: "fa-folder-open" },
  { href: "/subscription", label: "Subscription", icon: "fa-crown" },
  { href: "/ai", label: "WhatsApp AI Agent", icon: "fa-robot" },
  { href: "/support", label: "Support", icon: "fa-life-ring" },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Portfolio Overview",
  "/managers": "Profiles",
  "/owners": "Owners & Landlords",
  "/properties": "Properties & Leases",
  "/bills": "Bills & Utility Payments",
  "/rentals": "Rental Collection",
  "/tax": "Tax & Compliance Audit",
  "/documents": "Document Vault",
  "/subscription": "Subscription & Billing",
  "/ai": "WhatsApp AI Agent",
  "/support": "Support & Feedback",
};

// Short-lived cache for the header's user + AI-agent status so full page loads
// (e.g. F5) render the header instantly and revalidate in the background.
const SHELL_CACHE_KEY = "assethub:shell:v1";
const SHELL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    let active = true;

    // Hydrate the header instantly from a short-lived session cache (if any),
    // then revalidate both endpoints in parallel in the background so the
    // header never blocks first paint on two serverless round-trips.
    try {
      const cached = sessionStorage.getItem(SHELL_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as {
          user?: { id: string; name: string; email: string; role: string } | null;
          aiEnabled?: boolean | null;
          ts?: number;
        };
        const fresh = typeof data.ts === "number" && Date.now() - data.ts < SHELL_CACHE_TTL;
        if (data.user) setUser(data.user);
        // AI status can change; only trust it while fresh.
        if (fresh && data.aiEnabled !== undefined) setAiEnabled(Boolean(data.aiEnabled));
      }
    } catch {
      // ignore malformed cache
    }

    Promise.all([
      fetch("/api/ai/config").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([configData, meData]) => {
        if (!active) return;
        const nextAi = Boolean(configData?.config?.enabled);
        const nextUser = meData?.user ?? null;
        if (configData?.config) setAiEnabled(nextAi);
        if (meData?.user) setUser(nextUser);
        try {
          sessionStorage.setItem(
            SHELL_CACHE_KEY,
            JSON.stringify({ user: nextUser, aiEnabled: nextAi, ts: Date.now() }),
          );
        } catch {
          // storage unavailable (private mode etc.) — header still works
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const title = TITLES[pathname] ?? "AssetHub";

  return (
    <>
      <RouteProgress />
      <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-gradient-to-b from-primary-900 to-primary text-white md:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg">
            <i className="fa-solid fa-building-user" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">AssetHub</h1>
            <p className="text-[11px] text-blue-300">Intelligent Portfolio Manager</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-white/15 text-white shadow-sm ring-1 ring-white/10"
                    : "text-blue-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <i className={cx("fa-solid w-5 text-center text-[15px]", item.icon, active ? "text-accent" : "text-blue-300 group-hover:text-white")} />
                {item.label}
                {active && <span className="ml-auto h-2 w-2 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-500 font-bold text-white">
              {user ? user.name.slice(0, 2).toUpperCase() : "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user ? user.name : "…"}</p>
              <p className="truncate text-xs text-blue-300">{user ? user.role : "Not signed in"}</p>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-blue-300 transition hover:bg-white/10 hover:text-white"
            >
              <i className="fa-solid fa-right-from-bracket text-xs" />
            </button>
          </div>
          <Link
            href="/privacy-policy"
            className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-blue-300 transition hover:text-white"
          >
            <i className="fa-solid fa-shield-halved text-[10px]" /> Privacy Policy
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/ai"
              className={cx(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition",
                aiEnabled === null
                  ? "border-slate-200 bg-slate-50 text-slate-500"
                  : aiEnabled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-100 text-slate-500",
              )}
              title="WhatsApp AI agent status — click to configure"
            >
              <span
                className={cx(
                  "h-2 w-2 rounded-full",
                  aiEnabled === null ? "bg-slate-300" : aiEnabled ? "bg-emerald-500 blinking-dot" : "bg-slate-400",
                )}
              />
              {aiEnabled === null ? "Agent…" : aiEnabled ? "AI Agent Live" : "AI Agent Off"}
            </Link>
            <button className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50">
              <i className="fa-regular fa-bell" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
    </>
  );
}
