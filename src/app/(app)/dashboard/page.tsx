import { prisma } from "@/lib/prisma";
import { BillStatus, PropertyStatus } from "@prisma/client";
import { formatMYR, formatDate, initials, cx } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";
import { getWhatsappUsage } from "@/lib/whatsapp";
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

const WA_ACTION_META: Record<string, { icon: string; cls: string; label: string }> = {
  RENT_REMINDER: { icon: "fa-bell", cls: "bg-blue-100 text-blue-600", label: "Rent reminder" },
  SELF_ALERT: { icon: "fa-triangle-exclamation", cls: "bg-red-100 text-red-600", label: "Self escalation" },
  CHAT_REPLY: { icon: "fa-comment-dots", cls: "bg-emerald-100 text-emerald-600", label: "Chat reply" },
  MAINTENANCE: { icon: "fa-wrench", cls: "bg-orange-100 text-orange-600", label: "Maintenance" },
  VIEWING: { icon: "fa-calendar-check", cls: "bg-purple-100 text-purple-600", label: "Viewing" },
  AUTO_REMOVED: { icon: "fa-user-minus", cls: "bg-slate-100 text-slate-600", label: "Auto-removed (lease expired)" },
};

const WA_STATUS_META: Record<string, { label: string; cls: string }> = {
  SENT: { label: "Sent", cls: "bg-emerald-100 text-emerald-700" },
  SKIPPED_QUOTA: { label: "Quota reached", cls: "bg-red-100 text-red-700" },
  TWILIO_NOT_CONFIGURED: { label: "Twilio not configured", cls: "bg-amber-100 text-amber-700" },
  FAILED: { label: "Failed", cls: "bg-red-100 text-red-700" },
  INFO: { label: "Info", cls: "bg-slate-100 text-slate-600" },
};

function waTimestamp(d: Date): string {
  return d.toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  const me = await requireUser();
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

  // Group attempts by tenant + action so repeated actions show every datetime.
  const waGroups = new Map<
    string,
    { subject: string; action: string; status: string; at: string[] }
  >();
  for (const log of whatsappLogs) {
    const subject = log.tenantName ?? log.propertyName ?? "System";
    const key = `${subject}::${log.action}`;
    const existing = waGroups.get(key);
    if (existing) existing.at.push(waTimestamp(log.createdAt));
    else waGroups.set(key, { subject, action: log.action, status: log.status, at: [waTimestamp(log.createdAt)] });
  }
  const groupedWaLogs = Array.from(waGroups.values());

  const kpis = [
    { label: "Total Properties", value: String(properties), icon: "fa-building", cls: "bg-blue-50 text-blue-600" },
    { label: "Occupancy Rate", value: `${occupancy}%`, icon: "fa-check-circle", cls: "bg-green-50 text-green-600" },
    { label: "Rent Arrears", value: formatMYR(arrears), icon: "fa-triangle-exclamation", cls: "bg-red-50 text-red-600", tone: "text-red-500" },
    { label: "Open Utility Bills", value: String(unpaidBills), icon: "fa-bolt", cls: "bg-orange-50 text-orange-600" },
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
              Portfolio Financial Snapshot
            </h3>
            <Link href="/tax" className="text-sm font-semibold text-primary hover:underline">
              View tax statements →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Monthly Rent Roll" value={formatMYR(rentRoll._sum.monthlyRent ?? 0)} />
            <Metric label="Collected (YTD)" value={formatMYR(collected)} positive />
            <Metric label="Rent Arrears" value={formatMYR(arrears)} negative />
            <Metric label="Expenses (YTD)" value={formatMYR(totalExpenses._sum.amount ?? 0)} />
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <i className="fa-solid fa-circle-info text-blue-500" />
            Net rental position: {formatMYR(collected - (totalExpenses._sum.amount ?? 0))} — expenses are verified
            against receipts in the document vault for LHDN compliance.
          </div>
        </div>

        {/* Rent arrears */}
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            <i className="fa-solid fa-triangle-exclamation mr-2 text-red-500" />
            Rent Arrears
          </h3>
          <ArrearsList scope={propIds} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="border-b border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800">
            <i className="fa-solid fa-robot mr-2 text-primary" />
            Recent Activity & AI Actions
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {auditLogs.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400">No activity recorded yet.</p>
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
                      {log.user ? <span className="font-medium text-slate-600"> · by {log.user.name}</span> : null}
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
              AI Agent Actions (WhatsApp)
            </h3>
            <p className="text-sm text-slate-500">
              What the WhatsApp AI agent tried on your tenants, and when — repeated actions show every execution time.
            </p>
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
              ? `WhatsApp messages sent this month: ${waUsage.used} (unlimited)`
              : `WhatsApp messages left: ${waUsage.left} of ${waUsage.limit}`}
          </span>
        </div>

        <div className="px-6 pb-6 pt-4">
          {groupedWaLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No AI agent actions yet. Configure your authorized tenants under WhatsApp AI Agent and run the reminder engine.
            </p>
          ) : (
            <ul className="space-y-3">
              {groupedWaLogs.map((g) => {
                const meta = WA_ACTION_META[g.action] ?? { icon: "fa-clock", cls: "bg-slate-100 text-slate-500", label: g.action.replace(/_/g, " ") };
                const status = WA_STATUS_META[g.status] ?? { label: g.status, cls: "bg-slate-100 text-slate-600" };
                return (
                  <li key={`${g.subject}::${g.action}`} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-full ${meta.cls}`}>
                          <i className={`fa-solid ${meta.icon}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{g.subject}</p>
                          <p className="text-xs text-slate-500">{meta.label}</p>
                        </div>
                      </div>
                      <span className={`pill ${status.cls}`}>{status.label}</span>
                    </div>
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

async function ArrearsList({ scope }: { scope: string[] | null }) {
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
    return <p className="text-sm text-slate-400">No outstanding rent. 🎉</p>;
  }

  return (
    <ul className="space-y-3">
      {arrears.map((a) => (
        <li key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
            {initials(a.lease.tenant.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{a.lease.tenant.name}</p>
            <p className="truncate text-xs text-slate-500">{a.lease.property.name}</p>
          </div>
          <span className="text-sm font-bold text-red-500">{formatMYR(a.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
