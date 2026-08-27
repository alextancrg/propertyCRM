import { prisma } from "@/lib/prisma";
import { BillStatus, PropertyStatus } from "@prisma/client";
import { formatMYR, formatDate, initials, cx } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";
import { getWhatsappUsage } from "@/lib/whatsapp";
import { getTranslations } from "@/lib/i18n-server";
import { dueDateForMonth } from "@/lib/rentals";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACTIVITY_ICON: Record<string, { icon: string; cls: string }> = {
  STAMPED: { icon: "fa-file-contract", cls: "bg-purple-100 text-purple-600" },
  COLLECTED: { icon: "fa-hand-holding-dollar", cls: "bg-emerald-100 text-emerald-600" },
  ARREARS: { icon: "fa-triangle-exclamation", cls: "bg-red-100 text-red-600" },
  PAID: { icon: "fa-check-double", cls: "bg-emerald-100 text-emerald-600" },
  CREATED: { icon: "fa-plus", cls: "bg-blue-100 text-blue-600" },
  UPLOADED: { icon: "fa-file-arrow-up", cls: "bg-slate-100 text-slate-600" },
  AI_REPLY: { icon: "fa-robot", cls: "bg-emerald-100 text-emerald-600" },
};

// action → i18n key (labels are looked up per-locale at render time).
const WA_ACTION_META: Record<string, { icon: string; cls: string; labelKey: string }> = {
  RENT_REMINDER: { icon: "fa-bell", cls: "bg-blue-100 text-blue-600", labelKey: "dashboard.waAction.rentReminder" },
  SELF_ALERT: { icon: "fa-triangle-exclamation", cls: "bg-red-100 text-red-600", labelKey: "dashboard.waAction.selfAlert" },
  CHAT_REPLY: { icon: "fa-comment-dots", cls: "bg-emerald-100 text-emerald-600", labelKey: "dashboard.waAction.chatReply" },
  MAINTENANCE: { icon: "fa-wrench", cls: "bg-orange-100 text-orange-600", labelKey: "dashboard.waAction.maintenance" },
  VIEWING: { icon: "fa-calendar-check", cls: "bg-purple-100 text-purple-600", labelKey: "dashboard.waAction.viewing" },
  AUTO_REMOVED: { icon: "fa-user-minus", cls: "bg-slate-100 text-slate-600", labelKey: "dashboard.waAction.autoRemoved" },
};

const WA_STATUS_META: Record<string, { labelKey: string; cls: string }> = {
  SENT: { labelKey: "dashboard.waStatus.sent", cls: "bg-emerald-100 text-emerald-700" },
  SKIPPED_QUOTA: { labelKey: "dashboard.waStatus.quotaReached", cls: "bg-red-100 text-red-700" },
  TWILIO_NOT_CONFIGURED: { labelKey: "dashboard.waStatus.twilioNotConfigured", cls: "bg-amber-100 text-amber-700" },
  FAILED: { labelKey: "dashboard.waStatus.failed", cls: "bg-red-100 text-red-700" },
  INFO: { labelKey: "dashboard.waStatus.info", cls: "bg-slate-100 text-slate-600" },
};

function waTimestamp(d: Date): string {
  return d.toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Pull the "[Twilio: …]" failure reason out of a logged message, if present. */
function extractTwilioReason(message: string | null | undefined): string | undefined {
  if (!message) return undefined;
  const m = message.match(/\[Twilio:\s*([^\]]+)\]/);
  return m ? m[1].trim() : undefined;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole days from b to a (clamped at 0). */
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000));
}

export default async function DashboardPage() {
  const me = await requireUser();
  const { t } = await getTranslations();
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);

  // Property managers only see the properties owned by owners they are tied to.
  const propIds = await visiblePropertyIds(me);
  const propScope = propIds ? { id: { in: propIds } } : {};
  const rentScope = propIds ? { lease: { propertyId: { in: propIds } } } : {};

  const [properties, unpaidRent, paidRent, unpaidBills, auditLogs, totalExpenses] = await Promise.all([
    prisma.property.count({ where: { deletedAt: null, ...propScope } }),
    prisma.rentPayment.aggregate({ where: { status: BillStatus.UNPAID, ...rentScope }, _sum: { amount: true } }),
    prisma.rentPayment.aggregate({ where: { status: BillStatus.PAID, ...rentScope }, _sum: { amount: true } }),
    prisma.billPayment.count({
      where: { status: BillStatus.UNPAID, ...(propIds ? { bill: { propertyId: { in: propIds } } } : {}) },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } } },
    }),
    prisma.expense.aggregate({
      where: { incurredAt: { gte: startOfYear }, ...(propIds ? { propertyId: { in: propIds } } : {}) },
      _sum: { amount: true },
    }),
  ]);

  const occupied = await prisma.property.count({
    where: { status: { in: [PropertyStatus.LEASED, PropertyStatus.ARREARS] }, deletedAt: null, ...propScope },
  });
  const occupancy = properties > 0 ? Math.round((occupied / properties) * 100) : 0;
  const rentRoll = await prisma.lease.aggregate({
    where: { status: "ACTIVE", property: { deletedAt: null, ...propScope } },
    _sum: { monthlyRent: true },
  });

  const arrears = unpaidRent._sum.amount ?? 0;
  const collected = paidRent._sum.amount ?? 0;

  // WhatsApp AI agent — action feed + monthly message budget.
  const [whatsappLogs, waUsage] = await Promise.all([
    prisma.whatsAppMessageLog.findMany({
      where: propIds ? { propertyId: { in: propIds } } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getWhatsappUsage(me),
  ]);

  // Days overdue at the moment each self-escalation (red self-alert) was raised,
  // keyed by tenant name so the AI Agent Actions feed can show "X days overdue".
  const escalatedReminders = await prisma.rentReminder.findMany({
    where: { self: true, ...(propIds ? { lease: { propertyId: { in: propIds } } } : {}) },
    include: { lease: { select: { tenant: { select: { name: true } } } } },
    orderBy: { sentAt: "desc" },
  });
  const escalationDays = new Map<string, number>();
  for (const r of escalatedReminders) {
    if (escalationDays.has(r.lease.tenant.name)) continue;
    escalationDays.set(r.lease.tenant.name, r.dueDate ? daysBetween(r.sentAt, r.dueDate) : 0);
  }

  // Group attempts by tenant + action so repeated actions show every datetime.
  const waGroups = new Map<
    string,
    { subject: string; action: string; status: string; at: string[]; reason?: string }
  >();
  for (const log of whatsappLogs) {
    const subject = log.tenantName ?? log.propertyName ?? "System";
    const key = `${subject}::${log.action}`;
    const reason = log.status === "FAILED" ? extractTwilioReason(log.message) : undefined;
    const existing = waGroups.get(key);
    if (existing) {
      existing.at.push(waTimestamp(log.createdAt));
      if (reason && !existing.reason) existing.reason = reason;
    } else {
      waGroups.set(key, { subject, action: log.action, status: log.status, at: [waTimestamp(log.createdAt)], reason });
    }
  }
  const groupedWaLogs = Array.from(waGroups.values());

  const kpis = [
    { label: t("dashboard.totalProperties"), value: String(properties), icon: "fa-building", cls: "bg-blue-50 text-blue-600" },
    { label: t("dashboard.occupancyRate"), value: `${occupancy}%`, icon: "fa-check-circle", cls: "bg-green-50 text-green-600" },
    { label: t("dashboard.rentArrears"), value: formatMYR(arrears), icon: "fa-triangle-exclamation", cls: "bg-red-50 text-red-600", tone: "text-red-500" },
    { label: t("dashboard.openUtilityBills"), value: String(unpaidBills), icon: "fa-bolt", cls: "bg-orange-50 text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{k.label}</p>
                <h3 className={`mt-2 text-3xl font-bold tracking-tight ${k.tone ?? "text-slate-900"}`}>{k.value}</h3>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${k.cls}`}>
                <i className={`fa-solid ${k.icon}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Financial snapshot */}
        <div className="card p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              <i className="fa-solid fa-chart-line mr-2 text-primary" />
              {t("dashboard.snapshot")}
            </h3>
            <Link href="/tax" className="text-sm font-semibold text-primary hover:underline">
              {t("dashboard.viewTaxStatements")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label={t("dashboard.monthlyRentRoll")} value={formatMYR(rentRoll._sum.monthlyRent ?? 0)} />
            <Metric label={t("dashboard.collectedYtd")} value={formatMYR(collected)} positive />
            <Metric label={t("dashboard.rentArrears")} value={formatMYR(arrears)} negative />
            <Metric label={t("dashboard.expensesYtd")} value={formatMYR(totalExpenses._sum.amount ?? 0)} />
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <i className="fa-solid fa-circle-info text-blue-500" />
            {t("dashboard.netPosition", { amount: formatMYR(collected - (totalExpenses._sum.amount ?? 0)) })}
          </div>
        </div>

        {/* Rent arrears */}
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            <i className="fa-solid fa-triangle-exclamation mr-2 text-red-500" />
            {t("dashboard.rentArrears")}
          </h3>
          <ArrearsList scope={propIds} t={t} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="border-b border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800">
            <i className="fa-solid fa-robot mr-2 text-primary" />
            {t("dashboard.recentActivity")}
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {auditLogs.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400">{t("dashboard.noActivity")}</p>
          )}
          {auditLogs.map((log) => {
            const meta = ACTIVITY_ICON[log.action] ?? { icon: "fa-clock", cls: "bg-slate-100 text-slate-500" };
            return (
              <div key={log.id} className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`grid h-10 w-10 place-items-center rounded-full ${meta.cls}`}>
                    <i className={`fa-solid ${meta.icon}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{log.action.replace("_", " ")} · {log.entityType}</p>
                    <p className="text-xs text-slate-500">
                      {log.description}
                      {log.user ? <span className="font-medium text-slate-600">{t("dashboard.byUser", { name: log.user.name })}</span> : null}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-400">{formatDate(log.createdAt)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* WhatsApp AI agent actions */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              <i className="fa-solid fa-robot mr-2 text-primary" />
              {t("dashboard.waTitle")}
            </h3>
            <p className="text-sm text-slate-500">{t("dashboard.waSubtitle")}</p>
          </div>
          <span
            className={cx(
              "pill px-3 py-1 text-xs",
              waUsage.limit === null
                ? "bg-emerald-100 text-emerald-700"
                : (waUsage.left ?? 0) === 0
                  ? "bg-red-100 text-red-700"
                  : "bg-sky-100 text-sky-700",
            )}
          >
            <i className="fa-solid fa-message mr-1" />
            {waUsage.limit === null
              ? t("dashboard.waSentUnlimited", { used: waUsage.used })
              : t("dashboard.waLeft", { left: waUsage.left ?? 0, limit: waUsage.limit })}
          </span>
        </div>

        <div className="px-6 pb-6 pt-4">
          {groupedWaLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{t("dashboard.waEmpty")}</p>
          ) : (
            <ul className="space-y-3">
              {groupedWaLogs.map((g) => {
                const meta = WA_ACTION_META[g.action] ?? { icon: "fa-clock", cls: "bg-slate-100 text-slate-500", labelKey: null as string | null };
                const status = WA_STATUS_META[g.status] ?? { labelKey: null as string | null, cls: "bg-slate-100 text-slate-600" };
                const actionLabel = meta.labelKey ? t(meta.labelKey) : g.action.replace(/_/g, " ");
                const statusLabel = status.labelKey ? t(status.labelKey) : g.status;
                const escalationOverdue =
                  g.action === "SELF_ALERT" ? escalationDays.get(g.subject) : undefined;
                return (
                  <li key={`${g.subject}::${g.action}`} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-full ${meta.cls}`}>
                          <i className={`fa-solid ${meta.icon}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{g.subject}</p>
                          <p className="text-xs text-slate-500">{actionLabel}</p>
                          {g.action === "SELF_ALERT" && escalationOverdue !== undefined && (
                            <p className="mt-0.5 text-xs font-semibold text-red-600">
                              <i className="fa-solid fa-triangle-exclamation mr-1" />
                              {t("dashboard.escalationOverdue", { count: escalationOverdue })}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`pill ${status.cls}`}>{statusLabel}</span>
                    </div>
                    {g.reason && (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                        <i className="fa-solid fa-circle-exclamation mr-1" /> {g.reason}
                      </p>
                    )}
                    {g.at.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {g.at.map((t, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                            <i className="fa-regular fa-clock text-slate-400" />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${positive ? "text-emerald-600" : negative ? "text-red-500" : "text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

async function ArrearsList({ scope, t }: { scope: string[] | null; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const arrears = await prisma.rentPayment.findMany({
    where: {
      status: BillStatus.UNPAID,
      ...(scope ? { lease: { propertyId: { in: scope } } } : {}),
    },
    include: { lease: { include: { tenant: true, property: true } } },
    orderBy: { amount: "desc" },
    take: 5,
  });

  if (arrears.length === 0) {
    return <p className="text-sm text-slate-400">{t("dashboard.noOutstandingRent")}</p>;
  }

  // Which of these arrears have already been escalated (self-WhatsApp raised)?
  const escalatedKeys = new Set<string>();
  const escalatedReminders = await prisma.rentReminder.findMany({
    where: {
      self: true,
      leaseId: { in: arrears.map((a) => a.leaseId) },
      month: { in: arrears.map((a) => a.month) },
    },
    select: { leaseId: true, month: true },
  });
  escalatedReminders.forEach((r) => escalatedKeys.add(`${r.leaseId}::${r.month}`));

  return (
    <ul className="space-y-3">
      {arrears.map((a) => {
        const dueDate = dueDateForMonth(a.month, a.lease.startDate);
        const daysOverdue = daysBetween(new Date(), dueDate);
        const isEscalated = escalatedKeys.has(`${a.leaseId}::${a.month}`);
        return (
          <li key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
              {initials(a.lease.tenant.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{a.lease.tenant.name}</p>
              <p className="truncate text-xs text-slate-500">{a.lease.property.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-red-500">
                {t("dashboard.daysOverdue", { count: daysOverdue })}
                {isEscalated && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                    <i className="fa-solid fa-triangle-exclamation mr-0.5" /> {t("dashboard.escalated")}
                  </span>
                )}
              </p>
            </div>
            <span className="text-sm font-bold text-red-500">{formatMYR(a.amount)}</span>
          </li>
        );
      })}
    </ul>
  );
}
