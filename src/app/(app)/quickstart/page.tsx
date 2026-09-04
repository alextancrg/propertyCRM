import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";

export const dynamic = "force-dynamic";

type Step = {
  n: number;
  href: string;
  icon: string;
  color: string; // tailwind accent classes for the icon chip
  title: string;
  desc: string;
  points: string[];
  done: boolean;
  doneLabel: string;
  cta: string;
};

export default async function QuickstartPage() {
  const me = await requireUser();
  const scope = await visiblePropertyIds(me);

  // Live completion signals so each step shows a real progress state.
  const [ownerCount, propertyCount, billCount, documentCount, activeLeaseCount] = await Promise.all([
    prisma.owner.count({ where: { deletedAt: null, ...(scope ? { createdById: { in: [me.id] } } : {}) } }),
    prisma.property.count({ where: { deletedAt: null, ...(scope ? { id: { in: scope } } : {}) } }),
    prisma.bill.count({
      where: scope ? { property: { id: { in: scope }, deletedAt: null } } : { property: { deletedAt: null } },
    }),
    prisma.document.count({
      where: scope ? { propertyId: { in: scope } } : {},
    }),
    prisma.lease.count({
      where: {
        status: "ACTIVE",
        ...(scope ? { propertyId: { in: scope } } : {}),
      },
    }),
  ]);

  // Rental-collection configuration = at least one active lease is enough to
  // demonstrate collection; rent start/grace dates ride on the property form.
  const steps: Step[] = [
    {
      n: 1,
      href: "/owners",
      icon: "fa-users",
      color: "bg-blue-100 text-blue-700",
      title: "Add Owners",
      desc: "Register the landlords who own your units. Owners receive tax statements and can be assigned joint-venture shares.",
      points: [
        "Go to Owners → Add Owner",
        "Enter name, IC number, phone & email",
        "Joint-venture owners share % on the property later",
      ],
      done: ownerCount > 0,
      doneLabel: `${ownerCount} owner${ownerCount === 1 ? "" : "s"} on file`,
      cta: "Go to Owners →",
    },
    {
      n: 2,
      href: "/properties",
      icon: "fa-house",
      color: "bg-violet-100 text-violet-700",
      title: "Add Properties & Leases",
      desc: "Create each unit, then attach the tenant and lease. Deposits, unit tags and meter defaults are configured here.",
      points: [
        "Go to Properties & Leases → Add New Unit",
        "Fill in the unit details and owners with share %",
        "In 'Tenant & lease' add tenant, rent, deposit and tenure",
        "Upcoming tenant? Use 'Add future tenancy' in the row's Actions",
      ],
      done: propertyCount > 0,
      doneLabel: `${propertyCount} unit${propertyCount === 1 ? "" : "s"} · ${activeLeaseCount} active lease${activeLeaseCount === 1 ? "" : "s"}`,
      cta: "Go to Properties →",
    },
    {
      n: 3,
      href: "/bills",
      icon: "fa-list-check",
      color: "bg-amber-100 text-amber-700",
      title: "Configure Bills & Utilities",
      desc: "Set up recurring bills (TNB, water, sewerage, JMB, quit rent, assessment) with their due-date pattern so nothing is missed.",
      points: [
        "Go to Bills & Utilities → Add Bill",
        "Choose the provider, schedule (monthly/quarterly/…) and due dates",
        "Mark paid each cycle with the receipt attached for audit readiness",
      ],
      done: billCount > 0,
      doneLabel: `${billCount} bill schedule${billCount === 1 ? "" : "s"} configured`,
      cta: "Go to Bills →",
    },
    {
      n: 4,
      href: "/rentals",
      icon: "fa-hand-holding-dollar",
      color: "bg-emerald-100 text-emerald-700",
      title: "Rental Collection Setup",
      desc: "Rent collection builds itself from each lease. Tune the rent start date and grace period on the property, then track monthly payments.",
      points: [
        "Rent due dates follow the property's rent collection start date",
        "Grace period (days) controls when unpaid rent turns 'overdue'",
        "Open Rental Collection to record payments and upload slips",
      ],
      done: activeLeaseCount > 0,
      doneLabel: activeLeaseCount > 0 ? "Collection ready — leases active" : "Needs an active lease (step 2)",
      cta: "Go to Rental Collection →",
    },
    {
      n: 5,
      href: "/documents",
      icon: "fa-folder-open",
      color: "bg-cyan-100 text-cyan-700",
      title: "File Documents",
      desc: "Build the secure vault: tenancy agreements, receipts, insurance and titles — with LHDN stamping status for audit readiness.",
      points: [
        "Go to Documents → Upload",
        "Attach to a property/tenant and pick the category",
        "Mark the stamping status of tenancy agreements",
      ],
      done: documentCount > 0,
      doneLabel: `${documentCount} document${documentCount === 1 ? "" : "s"} filed`,
      cta: "Go to Documents →",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header + overall progress */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              <i className="fa-solid fa-map-signs mr-2 text-primary" /> Welcome to AssetHub, {me.name.split(" ")[0]}!
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Follow these five steps in order to set up your portfolio. Each step unlocks the next part of your
              workflow — owners first, then units & leases, bills, rental collection, and finally your document vault.
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-primary">{pct}%</p>
            <p className="text-xs font-semibold text-slate-400">
              {doneCount} of {steps.length} steps done
            </p>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Flow diagram — the five steps in order */}
      <div className="card p-6">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-wide text-slate-400">Setup flow</p>
        <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
          {steps.map((s, i) => (
            <div key={s.n} className="flex flex-1 flex-col items-center gap-2 lg:flex-row">
              <Link
                href={s.href}
                className={`
                  flex w-full items-center gap-3 rounded-xl border p-3 transition
                  ${
                    s.done
                      ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-primary/40 hover:bg-primary-50/30"
                  }
                `}
              >
                <span
                  className={cxStepChip(s.done)}
                >
                  {s.done ? <i className="fa-solid fa-check" /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-800">{s.title}</span>
                  <span className="block truncate text-[10px] text-slate-400">{s.doneLabel}</span>
                </span>
              </Link>
              {i < steps.length - 1 && (
                <i className="fa-solid fa-arrow-down shrink-0 text-slate-300 lg:fa-arrow-right" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detailed step cards */}
      <div className="space-y-4">
        {steps.map((s) => (
          <div
            key={s.n}
            className={`card p-5 ${s.done ? "border-emerald-200 bg-emerald-50/30" : ""}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* Numbered icon rail */}
              <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-center">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg ${s.color}`}>
                  <i className={`fa-solid ${s.icon}`} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                  Step {s.n}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-slate-900">{s.title}</h4>
                  {s.done ? (
                    <span className="pill border bg-emerald-100 text-emerald-700 border-emerald-200">
                      <i className="fa-solid fa-check text-[10px]" /> Done — {s.doneLabel}
                    </span>
                  ) : (
                    <span className="pill border bg-slate-100 text-slate-500 border-slate-200">
                      <i className="fa-regular fa-clock text-[10px]" /> Not started
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{s.desc}</p>

                <ol className="mt-3 space-y-1.5">
                  {s.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
                        {i + 1}
                      </span>
                      {p}
                    </li>
                  ))}
                </ol>

                <Link href={s.href} className="btn-primary mt-4 inline-flex text-sm">
                  {s.cta}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Finish line */}
      {doneCount === steps.length && (
        <div className="card border-emerald-200 bg-emerald-50/50 p-6 text-center">
          <i className="fa-solid fa-party-horn mb-2 text-2xl text-emerald-500" />
          <h4 className="font-bold text-emerald-800">Setup complete!</h4>
          <p className="mt-1 text-sm text-emerald-700">
            Your portfolio is fully configured. Head to the Dashboard for KPIs, or explore Tax & Audit and the
            WhatsApp AI Agent.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn-primary text-sm">
              <i className="fa-solid fa-chart-pie" /> Open Dashboard
            </Link>
            <Link href="/tax" className="btn-ghost text-sm">
              <i className="fa-solid fa-file-invoice-dollar" /> Tax & Audit
            </Link>
            <Link href="/ai" className="btn-ghost text-sm">
              <i className="fa-solid fa-robot" /> AI Agent
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function cxStepChip(done: boolean): string {
  return cxChip(done);
}

function cxChip(done: boolean): string {
  return [
    "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black",
    done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600",
  ].join(" ");
}
