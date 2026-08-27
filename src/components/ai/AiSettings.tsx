"use client";

import { useEffect, useRef, useState } from "react";
import { cx, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

type Config = {
  enabled: boolean;
  provider: string;
  model: string;
  systemPrompt: string;
  greeting: string;
  escalationEmail: string;
  autonomyLevel: string;
  autoRentReminder: boolean;
  autoMaintenanceTriage: boolean;
  autoViewingSchedule: boolean;
  tenantNames: string;
};

type Msg = { id: string; role: "ai" | "tenant"; content: string };

type Reminder = {
  id: string;
  month: string;
  stage: string;
  message: string;
  self: boolean;
  sentAt: string;
  property: string;
  tenant: string;
  phone: string | null;
};

type TenantOption = {
  id: string;
  name: string;
  phone: string | null;
  unit: string;
};

type Usage = { limit: number | null; used: number; left: number | null };

export function AiSettings({
  me,
  planName,
  config: initialConfig,
  eligibleTenants,
  authorizedTenantIds,
  usage: initialUsage,
  prunedCount,
  twilioConfigured,
  initialMessages,
  initialReminders,
}: {
  me: { id: string; name: string; email: string; role: string };
  planName: string;
  config: Config;
  eligibleTenants: TenantOption[];
  authorizedTenantIds: string[];
  usage: Usage;
  prunedCount: number;
  twilioConfigured: boolean;
  initialMessages: Msg[];
  initialReminders: Reminder[];
}) {
  const { t } = useI18n();
  // Escalations are always routed to the logged-in property manager's account
  // email. The field is read-only, so default the persisted value to it too.
  const [config, setConfig] = useState<Config>({ ...initialConfig, escalationEmail: me.email });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Authorized tenants (per manager) + WhatsApp message budget.
  const [eligible, setEligible] = useState<TenantOption[]>(eligibleTenants);
  const [authorized, setAuthorized] = useState<string[]>(authorizedTenantIds);
  const [usage, setUsage] = useState<Usage>(initialUsage);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [savingTenants, setSavingTenants] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [tenantSuccess, setTenantSuccess] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function runReminders() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/whatsapp/reminders", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRunResult(
          t("ai.runResult", {
            reminders: data.reminders ?? 0,
            escalated: data.escalated ?? 0,
            skipped: data.skipped ?? 0,
          }),
        );
        const list = await fetch("/api/whatsapp/reminders").then((r) => r.json());
        setReminders(list.reminders ?? []);
        const tenantsRes = await fetch("/api/ai/tenants");
        const tenantsData = await tenantsRes.json().catch(() => ({}));
        if (tenantsData?.usage) setUsage(tenantsData.usage);
      } else {
        setRunResult(t("ai.runFailed"));
      }
    } finally {
      setRunning(false);
    }
  }

  async function persist(next: Config) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/ai/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleEnabled() {
    const next = { ...config, enabled: !config.enabled };
    setConfig(next);
    persist(next);
  }

  function toggleField(field: "autoRentReminder" | "autoMaintenanceTriage" | "autoViewingSchedule") {
    const next = { ...config, [field]: !config[field] };
    setConfig(next);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    await persist(config);
  }

  // --- Authorized tenant list management (per manager) ---
  const candidates = eligible.filter((t) => !authorized.includes(t.id));

  async function applyAuthorized(nextIds: string[]) {
    setSavingTenants(true);
    setTenantError(null);
    setTenantSuccess(null);
    try {
      const res = await fetch("/api/ai/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantIds: nextIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not update authorized tenants.");
      setEligible(data.eligible ?? eligible);
      setAuthorized(data.authorized ?? nextIds);
      if (data.usage) setUsage(data.usage);
      setSelectedCandidate("");
      setTenantSuccess(t("ai.authorizedUpdated"));
      setTimeout(() => setTenantSuccess(null), 2000);
    } catch (err) {
      setTenantError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setSavingTenants(false);
    }
  }

  async function addTenant() {
    if (!selectedCandidate || savingTenants) return;
    await applyAuthorized([...authorized, selectedCandidate]);
  }

  async function removeTenant(tenantId: string) {
    if (savingTenants) return;
    await applyAuthorized(authorized.filter((id) => id !== tenantId));
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    const optimistic: Msg = { id: `tmp-${Date.now()}`, role: "tenant", content: text };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), optimistic, { id: `ai-${Date.now()}`, role: "ai", content: data.reply }]);
    } catch {
      setMessages((m) => [...m, { id: `ai-${Date.now()}`, role: "ai", content: t("ai.chatError") }]);
    } finally {
      setSending(false);
    }
  }

  async function resetChat() {
    await fetch("/api/ai/chat", { method: "DELETE" });
    setMessages([]);
  }

  const quotaExhausted = usage.limit !== null && usage.left === 0;
  const budgetPct =
    usage.limit !== null && usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Hero / toggle */}
      <div className={cx("card relative overflow-hidden p-6", config.enabled ? "border-emerald-200" : "border-slate-200")}>
        <div className={cx("absolute inset-y-0 left-0 w-1", config.enabled ? "bg-emerald-500" : "bg-slate-300")} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={cx("grid h-14 w-14 place-items-center rounded-2xl text-2xl", config.enabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>
              <i className="fa-brands fa-whatsapp" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t("ai.heroTitle")}</h3>
              <p className="max-w-xl text-sm text-slate-500">{t("ai.heroDesc")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={cx("pill", config.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>
                  <i className={cx("fa-solid", config.enabled ? "fa-circle-check" : "fa-circle-pause")} />
                  {config.enabled ? t("ai.enabled") : t("ai.disabled")}
                </span>
                <span className={cx("pill", twilioConfigured ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}>
                  <i className={cx("fa-solid", twilioConfigured ? "fa-circle-check" : "fa-triangle-exclamation")} />
                  {twilioConfigured ? t("ai.twilioConnected") : t("ai.twilioNotConfigured")}
                </span>
              </div>
            </div>
          </div>

          <button
            role="switch"
            aria-checked={config.enabled}
            onClick={toggleEnabled}
            className={cx(
              "relative h-8 w-16 shrink-0 rounded-full transition-colors",
              config.enabled ? "bg-emerald-500" : "bg-slate-300",
            )}
            title={config.enabled ? t("ai.disableAgent") : t("ai.enableAgent")}
          >
            <span
              className={cx(
                "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
                config.enabled ? "left-9" : "left-1",
              )}
            />
          </button>
        </div>

        {/* WhatsApp message budget */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cx("grid h-10 w-10 place-items-center rounded-xl", quotaExhausted ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600")}>
                <i className="fa-solid fa-message" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {usage.limit === null
                    ? t("ai.unlimitedMessages")
                    : t("ai.messagesLeft", { left: usage.left ?? 0, limit: usage.limit })}
                </p>
                <p className="text-xs text-slate-500">
                  {usage.limit === null
                    ? t("ai.sentNoLimit", { used: usage.used })
                    : t("ai.usedPlan", { used: usage.used, planName })}
                </p>
              </div>
            </div>
            {quotaExhausted && (
              <span className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                {t("ai.quotaExhausted")}
              </span>
            )}
          </div>
          {usage.limit !== null && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={cx("h-full rounded-full transition-all", quotaExhausted ? "bg-red-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          )}
        </div>

        {prunedCount > 0 && (
          <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
            <i className="fa-solid fa-user-minus mr-1" />
            {t("ai.prunedNotice", { count: prunedCount })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Configuration form */}
        <form onSubmit={saveForm} className="card space-y-5 p-6">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-slate-900">
              <i className="fa-solid fa-sliders mr-2 text-primary" /> {t("ai.configuration")}
            </h4>
            {saved && <span className="text-xs font-semibold text-emerald-600"><i className="fa-solid fa-check" /> {t("ai.saved")}</span>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
            <i className="fa-solid fa-lock mr-1" />
            {t("ai.modelLocked")}
          </div>

          <div>
            <label className="label mb-1">{t("ai.autonomyLevel")}</label>
            <select value={config.autonomyLevel} onChange={(e) => setConfig({ ...config, autonomyLevel: e.target.value })} className="input cursor-pointer">
              <option value="semi">{t("ai.semiOption")}</option>
              <option value="full">{t("ai.fullOption")}</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {config.autonomyLevel === "full" ? t("ai.fullDesc") : t("ai.semiDesc")}
            </p>
          </div>

          <div>
            <label className="label mb-1">{t("ai.greeting")}</label>
            <input value={config.greeting} onChange={(e) => setConfig({ ...config, greeting: e.target.value })} className="input" placeholder={t("ai.greetingPlaceholder")} />
          </div>

          <div>
            <label className="label mb-1">{t("ai.systemPrompt")}</label>
            <textarea value={config.systemPrompt} onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })} rows={4} className="input resize-none" />
          </div>

          <div>
            <label className="label mb-1">{t("ai.escalationEmail")}</label>
            <input
              value={me.email}
              disabled
              className="input cursor-not-allowed bg-slate-100 text-slate-500"
              title={me.email}
            />
            <p className="mt-1 text-xs text-slate-500">
              {t("ai.escalationHint", { email: me.email })}
            </p>
          </div>

          <div>
            <p className="label mb-2">{t("ai.automationBehaviours")}</p>
            <div className="space-y-2">
              <Toggle label={t("ai.autoRentReminder")} desc={t("ai.autoRentReminderDesc")} checked={config.autoRentReminder} onChange={() => toggleField("autoRentReminder")} />
              <Toggle label={t("ai.autoMaintenanceTriage")} desc={t("ai.autoMaintenanceTriageDesc")} checked={config.autoMaintenanceTriage} onChange={() => toggleField("autoMaintenanceTriage")} />
              <Toggle label={t("ai.autoViewingSchedule")} desc={t("ai.autoViewingScheduleDesc")} checked={config.autoViewingSchedule} onChange={() => toggleField("autoViewingSchedule")} />
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
            {saving ? <><i className="fa-solid fa-spinner fa-spin" /> {t("ai.saving")}</> : t("ai.saveConfig")}
          </button>

        </form>

        {/* Right column: authorized tenants + chat simulator */}
        <div className="space-y-6">
          {/* Authorized tenants */}
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900">
                <i className="fa-solid fa-user-check mr-2 text-primary" /> {t("ai.authorizedTenants")}
              </h4>
              {savingTenants && <span className="text-xs font-medium text-slate-400"><i className="fa-solid fa-spinner fa-spin" /> {t("ai.saving")}</span>}
            </div>
            <p className="mt-1 text-sm text-slate-500">{t("ai.authorizedTenantsDesc")}</p>

            {tenantError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                <i className="fa-solid fa-triangle-exclamation mr-1" /> {tenantError}
              </p>
            )}
            {tenantSuccess && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                <i className="fa-solid fa-circle-check mr-1" /> {tenantSuccess}
              </p>
            )}

            {/* Add tenant */}
            <div className="mt-4 flex gap-2">
              <select
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
                className="input cursor-pointer"
                disabled={candidates.length === 0}
              >
                <option value="">{candidates.length === 0 ? t("ai.noMoreEligible") : t("ai.selectTenantToAdd")}</option>
                {candidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.unit ? ` — ${t.unit}` : ""}{t.phone ? ` (${t.phone})` : ""}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addTenant} disabled={!selectedCandidate || savingTenants} className="btn-primary shrink-0">
                <i className="fa-solid fa-plus" /> {t("ai.add")}
              </button>
            </div>

            {/* Authorized list */}
            <div className="mt-4 space-y-2">
              {authorized.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                  {t("ai.noAuthorizedYet")}
                </p>
              )}
              {authorized.map((id) => {
                const tenant = eligible.find((e) => e.id === id);
                return (
                  <div key={id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                      {(tenant?.name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{tenant?.name ?? id}</p>
                      <p className="truncate text-xs text-slate-500">
                        {tenant?.unit ?? ""}
                        {tenant?.phone ? ` · ${tenant.phone}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTenant(id)}
                      disabled={savingTenants}
                      title={t("ai.removeFromAuthorized")}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat simulator */}
          <div className="card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#075e54] px-5 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
                  <i className="fa-solid fa-robot" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{t("ai.assistantName")}</p>
                  <p className="text-[11px] text-emerald-200">
                    {config.enabled ? t("ai.online") : t("ai.offline")}
                  </p>
                </div>
              </div>
              <button onClick={resetChat} className="rounded-full p-2 text-emerald-200 transition hover:bg-white/10" title={t("ai.clearConversation")}>
                <i className="fa-solid fa-broom" />
              </button>
            </div>

            <div className="h-[420px] space-y-3 overflow-y-auto bg-[#ece5dd] p-5" ref={chatRef}>
              {messages.length === 0 && (
                <div className="mx-auto mt-16 max-w-xs rounded-xl bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
                  <i className="fa-brands fa-whatsapp mb-2 text-2xl text-emerald-500" />
                  <p>{t("ai.chatEmpty")}</p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cx("flex", m.role === "tenant" ? "justify-end" : "justify-start")}>
                  <div
                    className={cx(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                      m.role === "tenant" ? "rounded-br-sm bg-[#dcf8c6]" : "rounded-bl-sm bg-white",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
                    <i className="fa-solid fa-ellipsis animate-pulse" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={config.enabled ? t("ai.typeMessage") : t("ai.agentDisabledPlaceholder")}
                className="input flex-1 rounded-full px-4"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow transition hover:bg-emerald-600 disabled:opacity-40"
              >
                <i className="fa-solid fa-paper-plane" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rent reminder engine */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <h4 className="text-base font-bold text-slate-900">
              <i className="fa-solid fa-bell mr-2 text-primary" /> {t("ai.reminderEngine")}
            </h4>
            <p className="max-w-3xl text-sm text-slate-500">{t("ai.reminderEngineDesc")}</p>
          </div>
          <button onClick={runReminders} disabled={running} className="btn-primary">
            <i className="fa-solid fa-play" /> {running ? t("ai.running") : t("ai.runReminders")}
          </button>
        </div>

        {runResult && (
          <p className="mx-6 mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <i className="fa-solid fa-circle-check mr-1" /> {runResult}
          </p>
        )}

        <div className="px-6 pb-6">
          {reminders.length === 0 ? (
            <p className="text-sm text-slate-400">{t("ai.noRemindersYet")}</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {reminders.map((r) => (
                <li key={r.id} className={cx("rounded-xl border p-3 text-sm", r.self ? "border-red-300 bg-red-50" : "border-slate-100 bg-slate-50/60")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={cx("text-xs font-bold uppercase tracking-wide", r.self ? "text-red-600" : "text-slate-500")}>
                      <i className={cx("mr-1", r.self ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-bell")} />
                      {r.stage} · {r.month} · {r.property}
                      {r.self && <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">{t("ai.selfWhatsappBadge")}</span>}
                    </p>
                    <span className="shrink-0 text-[10px] font-medium text-slate-400">{formatDate(r.sentAt)}</span>
                  </div>
                  <p className={cx("mt-1", r.self ? "font-semibold text-red-700" : "text-slate-600")}>{r.message}</p>
                  {r.self && r.phone && (
                    <p className="mt-1 text-xs font-bold text-red-600">
                      <i className="fa-brands fa-whatsapp mr-1" /> {t("ai.tenantPhone", { phone: r.phone })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-left transition hover:bg-slate-100">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <span className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-500" : "bg-slate-300")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}
