"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cx, formatMYR, formatDate, initials } from "@/lib/format";
import {
  PROPERTY_TYPES,
  PROPERTY_MAX_REMARKS,
  PROPERTY_UNIT_TAGS_MAX,
  PROPERTY_RENT_GRACE_DAYS_DEFAULT,
  LEASE_END_REMARKS_MAX,
  LEASE_END_NOTICE_DAYS,
  LEASE_END_RED_DAYS,
  LEASE_END_ORANGE_DAYS,
} from "@/lib/properties";
import { normalizePhoneE164 } from "@/lib/phone";
import { SUPPORTED_LOCALES } from "@/lib/translations";

type PropertyDTO = {
  id: string;
  name: string;
  type: string;
  address: string;
  location: string;
  status: string;
  rent: number;
  remarks: string | null;
  isOwnStay: boolean;
  unitTags: string | null;
  utilityDeposit: number;
  nextCheckInDate: string | null;
  rentStartDate: string | null;
  rentGraceDays: number;
  soldDate: string | null;
  owners: { ownerId: string; name: string; phone: string | null; icNumber: string | null; sharePercent: number }[];
  tenant: { id: string; name: string; phone: string | null; language: string } | null;
  monthlyRent: number | null;
  lease: {
    id: string;
    tenantId: string;
    tenantName: string;
    tenantPhone: string | null;
    monthlyRent: number;
    deposit: number;
    startDate: string;
    endDate: string | null;
    stampingRef: string | null;
    checkoutNotified: boolean;
    checkoutDate: string | null;
    leaseEndRemarks: string | null;
  } | null;
};

type OwnerDTO = { id: string; name: string; phone: string | null };

const PROPERTY_STATUSES = ["VACANT", "LEASED", "ARREARS", "SOLD"];

function leaseInYear(p: PropertyDTO, year: number): boolean {
  const l = p.lease;
  if (!l) return false;
  const startY = new Date(l.startDate).getFullYear();
  const endY = l.endDate ? new Date(l.endDate).getFullYear() : Infinity;
  return startY <= year && year <= endY;
}

/**
 * Lease-status bucket used by the status filter (matches the status column):
 *  - "vacant" — no active lease on file
 *  - "ended"  — lease has passed its end date (unit effectively empty / to re-let)
 *  - "ending" — lease ends within LEASE_END_ORANGE_DAYS (2 months)
 *  - "leased" — ongoing lease (incl. open-ended / notified checkout)
 */
function leaseFilterKey(p: PropertyDTO, now = new Date()): "vacant" | "ended" | "ending" | "leased" {
  const l = p.lease;
  if (!l) return "vacant";
  if (l.checkoutNotified) return "leased";
  const end = l.endDate ? new Date(l.endDate) : null;
  if (end) {
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft < 0) return "ended";
    if (daysLeft <= LEASE_END_ORANGE_DAYS) return "ending";
  }
  return "leased";
}

function matchesStatusFilter(p: PropertyDTO, filter: string, now = new Date()): boolean {
  const k = leaseFilterKey(p, now);
  switch (filter) {
    case "all":
      return true;
    case "vacant":
      // Vacant includes units whose lease has ended and need re-letting.
      return k === "vacant" || k === "ended";
    case "leased":
      return k === "leased";
    case "ending":
      return k === "ending";
    default:
      return true;
  }
}

type LeaseStatusView = {
  badge: { label: string; cls: string; icon: string };
  // Optional second line shown under the badge (e.g. "Est. Check In …" or a
  // hint that the lease is ending and can be managed).
  action: string | null;
};

/**
 * Derive the "Unit's Rental Status" cell for the Properties & Leases table.
 * Mirrors the EasyRenz design: purple "Contract End <date>", amber
 * "Notified Check Out <date>", and turquoise "Vacant". The status is a link
 * when there is something to manage (lease ending, notified checkout, ended).
 */
function leaseStatusView(p: PropertyDTO, now = new Date()): LeaseStatusView {
  const l = p.lease;
  if (!l) {
    return {
      badge: { label: "Vacant", cls: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: "fa-bed" },
      action: null,
    };
  }
  const end = l.endDate ? new Date(l.endDate) : null;
  const endLabel = end ? formatDate(l.endDate!) : null;

  if (l.checkoutNotified) {
    const date = l.checkoutDate ? formatDate(l.checkoutDate) : endLabel;
    return {
      badge: {
        label: date ? `Notified Check Out ${date}` : "Notified Check Out",
        cls: "bg-amber-100 text-amber-700 border-amber-200",
        icon: "fa-door-open",
      },
      action: p.nextCheckInDate ? `Est. Check In ${formatDate(p.nextCheckInDate)}` : "Edit notice",
    };
  }

  const daysLeft = end ? Math.ceil((end.getTime() - now.getTime()) / 86_400_000) : Infinity;
  if (end && daysLeft < 0) {
    return {
      badge: {
        label: endLabel ? `Contract Ended ${endLabel}` : "Contract Ended",
        cls: "bg-red-100 text-red-700 border-red-200",
        icon: "fa-circle-exclamation",
      },
      action: "Lease ended · manage",
    };
  }
  if (end) {
    // Urgency colors: expiring within ~1 month → red, within ~2 months →
    // orange, otherwise purple (default).
    const endCls =
      daysLeft <= LEASE_END_RED_DAYS
        ? "bg-red-100 text-red-700 border-red-200"
        : daysLeft <= LEASE_END_ORANGE_DAYS
          ? "bg-orange-100 text-orange-700 border-orange-200"
          : "bg-purple-100 text-purple-700 border-purple-200";
    return {
      badge: {
        label: endLabel ? `Contract End ${endLabel}` : "Contract End",
        cls: endCls,
        icon: "fa-calendar-day",
      },
      action: daysLeft <= LEASE_END_NOTICE_DAYS ? "Lease ending · add remarks / notify" : null,
    };
  }
  return {
    badge: { label: "Leased (Open)", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-check-circle" },
    action: null,
  };
}

export function PropertiesClient({
  properties,
  owners,
}: {
  properties: PropertyDTO[];
  owners: OwnerDTO[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PropertyDTO | null>(null);
  const [deleting, setDeleting] = useState<PropertyDTO | null>(null);
  const [leaseEnd, setLeaseEnd] = useState<PropertyDTO | null>(null);

  // Years are derived from lease coverage plus the current year.
  const yearOptions = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    properties.forEach((p) => {
      if (p.lease) {
        set.add(new Date(p.lease.startDate).getFullYear());
        if (p.lease.endDate) set.add(new Date(p.lease.endDate).getFullYear());
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [properties]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return properties.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
      const matchT = typeFilter === "All" || p.type === typeFilter;
      const matchS = matchesStatusFilter(p, statusFilter);
      const matchY = yearFilter === "all" || leaseInYear(p, Number(yearFilter));
      return matchQ && matchT && matchS && matchY;
    });
  }, [properties, query, typeFilter, statusFilter, yearFilter]);

  function openAdd() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(p: PropertyDTO) {
    setEditing(p);
    setShowModal(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Properties &amp; Leases</h3>
          <p className="text-sm text-slate-500">Manage units, ownership, tenancy, deposits, meter defaults, and lease-end status.</p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start sm:self-auto">
          <i className="fa-solid fa-plus" /> Add New Unit
        </button>
      </div>

      {/* Search + filters (year on top) */}
      <div className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search properties by name or location…"
            className="input pl-11"
          />
        </div>
        <div className="relative md:w-52">
          <i className="fa-regular fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="input pl-9 cursor-pointer"
            title="Filter by tenancy year — properties whose lease overlaps the selected year are shown"
          >
            <option value="all">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="relative md:w-52">
          <i className="fa-solid fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input pl-9 cursor-pointer">
            <option>All</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="relative md:w-64">
          <i className="fa-solid fa-house-circle-check absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input pl-9 cursor-pointer"
            title="Filter by lease status — Leased, Vacant, or lease ending within 2 months"
          >
            <option value="all">All lease statuses</option>
            <option value="leased">Leased</option>
            <option value="vacant">Vacant</option>
            <option value="ending">Lease ending (&lt; 2 months)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <i className="fa-solid fa-building-circle-xmark mb-3 text-4xl text-slate-300" />
          <p className="text-lg font-medium">No properties found.</p>
          {yearFilter !== "all" && (
            <p className="mt-1 text-sm text-slate-400">
              No property has a lease overlapping {yearFilter}. Try a different year.
            </p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Property Name</th>
                  <th className="px-4 py-3">Unit Tags</th>
                  <th className="px-4 py-3 text-right">Rental Fee</th>
                  <th className="px-4 py-3 text-right">Rental Deposit</th>
                  <th className="px-4 py-3 text-right">Utilities Deposit</th>
                  <th className="px-4 py-3">Unit&apos;s Rental Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const ls = leaseStatusView(p);
                  const tags = p.unitTags
                    ? p.unitTags
                        .split(",")
                        .map((t) => t.trim())
                        .filter((t) => t && t !== "null" && t !== "undefined")
                    : [];
                  return (
                    <tr
                      key={p.id}
                      className={cx(
                        "border-b border-slate-100 odd:bg-white even:bg-slate-50/60 transition hover:bg-blue-50/40",
                        p.status === "ARREARS" && "bg-red-50/40",
                      )}
                    >
                      {/* Property Name */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
                            <i className="fa-solid fa-building text-sm" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{p.name}</p>
                            <p className="truncate text-[11px] text-slate-500">
                              <span className="font-semibold uppercase text-slate-600">{p.type}</span>
                              {p.location && (
                                <>
                                  {" "}
                                  · <i className="fa-solid fa-location-dot mr-0.5" />
                                  {p.location}
                                </>
                              )}
                              {p.isOwnStay && (
                                <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-700">
                                  Own Stay
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Unit Tags */}
                      <td className="px-4 py-3 align-top">
                        {tags.length > 0 ? (
                          <div className="flex max-w-[170px] flex-wrap gap-1">
                            {tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-pink-100 bg-pink-50 px-2 py-0.5 text-[10px] font-semibold text-pink-700"
                              >
                                {t}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-[10px] font-semibold text-slate-400">+{tags.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      {/* Rental Fee */}
                      <td className="px-4 py-3 text-right align-top font-bold text-slate-900">
                        {formatMYR(p.monthlyRent ?? p.rent)}
                      </td>
                      {/* Rental Deposit */}
                      <td className="px-4 py-3 text-right align-top text-slate-700">
                        {p.lease ? formatMYR(p.lease.deposit) : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Utilities Deposit */}
                      <td className="px-4 py-3 text-right align-top text-slate-700">
                        {p.utilityDeposit ? formatMYR(p.utilityDeposit) : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Unit's Rental Status */}
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => setLeaseEnd(p)}
                          className={cx("group max-w-[215px] text-left", !ls.action && "cursor-default")}
                          title={ls.action ? "Manage lease-end status" : undefined}
                        >
                          <span className={cx("pill border", ls.badge.cls)}>
                            <i className={`fa-solid ${ls.badge.icon} text-[10px]`} /> {ls.badge.label}
                          </span>
                          {ls.action && (
                            <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary underline-offset-2 group-hover:underline">
                              <i className="fa-solid fa-circle-plus text-[10px]" /> {ls.action}
                            </span>
                          )}
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            title="Edit property"
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <i className="fa-solid fa-pen text-sm" />
                          </button>
                          <Link
                            href="/documents"
                            title="Documents"
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <i className="fa-solid fa-folder-open text-sm" />
                          </Link>
                          <button
                            onClick={() => setDeleting(p)}
                            title="Delete property"
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <i className="fa-solid fa-trash-can text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <PropertyFormModal
          property={editing}
          owners={owners}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          targetName={deleting.name}
          message="Deleting a property keeps its documents and older bills for record keeping."
          confirmLabel="Delete property"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const res = await fetch(`/api/properties/${deleting.id}`, { method: "DELETE" });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error ?? "Failed to delete property.");
            }
            setDeleting(null);
            router.refresh();
          }}
        />
      )}

      {leaseEnd && (
        <LeaseEndModal
          property={leaseEnd}
          onClose={() => setLeaseEnd(null)}
          onSaved={() => {
            setLeaseEnd(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Confirmation modal that requires retyping the target name before deleting. */
function DeleteConfirmModal({
  targetName,
  message,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  targetName: string;
  message: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const match = typed.trim() === targetName.trim();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!match) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the action.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="card w-full max-w-md">
        <div className="border-b border-slate-100 bg-red-50/60 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            <i className="fa-solid fa-triangle-exclamation mr-2 text-red-500" />
            {confirmLabel}
          </h3>
        </div>
        <div className="grid gap-4 p-6">
          <p className="text-sm text-slate-600">
            This action cannot be undone. {message}
          </p>
          <p className="text-sm text-slate-600">
            Type <span className="font-bold text-slate-900">{targetName}</span> to confirm:
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="input"
            placeholder={targetName}
            autoFocus
          />
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={!match || saving} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-40">
            {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Deleting…</> : confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/**
 * Lease-end status modal. Opened from the "Unit's Rental Status" cell of the
 * Properties & Leases table. Lets the manager:
 *  - attach lease-end remarks (e.g. reason for leaving, handover notes), and
 *  - mark that the tenant has informed they are vacating at lease expiry
 *    ("Notified Check Out"), with an optional check-out date and estimated
 *    next check-in date for the unit.
 */
function LeaseEndModal({
  property,
  onClose,
  onSaved,
}: {
  property: PropertyDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const lease = property.lease;
  const [checkoutNotified, setCheckoutNotified] = useState(lease?.checkoutNotified ?? false);
  const [checkoutDate, setCheckoutDate] = useState(
    lease?.checkoutDate ? lease.checkoutDate.slice(0, 10) : lease?.endDate ? lease.endDate.slice(0, 10) : "",
  );
  const [nextCheckIn, setNextCheckIn] = useState(property.nextCheckInDate ? property.nextCheckInDate.slice(0, 10) : "");
  const [remarks, setRemarks] = useState(lease?.leaseEndRemarks ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lease) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leases/${lease.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutNotified,
          checkoutDate: checkoutNotified && checkoutDate ? checkoutDate : null,
          nextCheckInDate: nextCheckIn || null,
          leaseEndRemarks: remarks || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save lease-end status.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="card w-full max-w-lg">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            <i className="fa-solid fa-door-open mr-2 text-primary" /> Lease-End Status — {property.name}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        <div className="grid gap-4 p-6">
          {!lease ? (
            <p className="text-sm text-slate-500">This unit has no active lease, so there is no lease-end status to manage.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Tenant: <span className="font-semibold text-slate-700">{lease.tenantName}</span> · Tenancy{" "}
                {formatDate(lease.startDate)} – {lease.endDate ? formatDate(lease.endDate) : "Open"}
                {lease.tenantPhone && (
                  <>
                    {" "}
                    · <span className="text-slate-400">{lease.tenantPhone}</span>
                  </>
                )}
              </p>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <input
                  type="checkbox"
                  checked={checkoutNotified}
                  onChange={(e) => setCheckoutNotified(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">
                    Tenant has informed — vacating unit at lease expiry
                  </span>
                  <br />
                  Marks the status as &quot;Notified Check Out&quot; so you can plan the handover and next tenancy.
                </span>
              </label>

              {checkoutNotified && (
                <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1">Check-out date</label>
                    <input
                      type="date"
                      value={checkoutDate}
                      onChange={(e) => setCheckoutDate(e.target.value)}
                      className="input cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="label mb-1">Est. next check-in (optional)</label>
                    <input
                      type="date"
                      value={nextCheckIn}
                      onChange={(e) => setNextCheckIn(e.target.value)}
                      className="input cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label mb-1">
                  Lease-end remarks{" "}
                  <span className="normal-case text-slate-400">
                    ({remarks.length}/{LEASE_END_REMARKS_MAX})
                  </span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value.slice(0, LEASE_END_REMARKS_MAX))}
                  rows={3}
                  className="input resize-none"
                  placeholder="e.g. Tenant relocating for work; handover on the last day; deposit refund pending final inspection…"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving || !lease} className="btn-primary">
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" /> Saving…
              </>
            ) : (
              "Save status"
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

type OwnerRow = {
  key: number;
  mode: "existing" | "new";
  ownerId: string;
  name: string;
  phone: string;
  share: string;
};

/**
 * Shared add/edit form for a property. Add and Update use the exact same form.
 * Supports multiple owners (total share must not exceed 100%).
 */
function PropertyFormModal({
  property,
  owners,
  onClose,
  onSaved,
}: {
  property: PropertyDTO | null;
  owners: OwnerDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(property);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [status, setStatus] = useState<string>(property?.status ?? "VACANT");
  const [remarks, setRemarks] = useState(property?.remarks ?? "");
  const [isOwnStay, setIsOwnStay] = useState(property?.isOwnStay ?? false);
  const [soldDate, setSoldDate] = useState(property?.soldDate ? property.soldDate.slice(0, 10) : "");
  const [unitTags, setUnitTags] = useState(property?.unitTags ?? "");
  const [utilityDeposit, setUtilityDeposit] = useState(property ? String(property.utilityDeposit || "") : "");
  // Rent (RM) and Monthly rent (RM) stay in sync — entering one sets the other.
  const [rentAmount, setRentAmount] = useState<string>(() =>
    property ? String(property.rent || property.monthlyRent || "") : "",
  );
  const [ownerRows, setOwnerRows] = useState<OwnerRow[]>(() =>
    property && property.owners.length > 0
      ? property.owners.map((o, i) => ({
          key: i,
          mode: "existing" as const,
          ownerId: o.ownerId,
          name: o.name,
          phone: o.phone ?? "",
          share: String(o.sharePercent),
        }))
      : [{ key: 0, mode: "existing" as const, ownerId: "", name: "", phone: "", share: "100" }],
  );
  const [tenantName, setTenantName] = useState(property?.lease?.tenantName ?? property?.tenant?.name ?? "");
  const [tenantPhone, setTenantPhone] = useState(property?.lease?.tenantPhone ?? property?.tenant?.phone ?? "");
  const [tenantLanguage, setTenantLanguage] = useState(property?.tenant?.language ?? "en");
  // Open-ended lease: no end date — runs until further notice.
  const [openEnded, setOpenEnded] = useState(property?.lease ? !property.lease.endDate : true);

  const totalShare = ownerRows.reduce((sum, r) => sum + (Number(r.share) || 0), 0);
  const shareExceeded = totalShare > 100.0001;

  function updateRow(key: number, patch: Partial<OwnerRow>) {
    setOwnerRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setOwnerRows((rows) => [
      ...rows,
      { key: Date.now(), mode: "existing", ownerId: "", name: "", phone: "", share: "" },
    ]);
  }

  function removeRow(key: number) {
    setOwnerRows((rows) => rows.filter((r) => r.key !== key));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    if (ownerRows.length === 0) {
      setError("At least one owner is required.");
      setSaving(false);
      return;
    }
    if (shareExceeded) {
      setError(`Total ownership share cannot exceed 100% (currently ${totalShare}%).`);
      setSaving(false);
      return;
    }

    const ownersPayload = ownerRows.map((r) =>
      r.mode === "existing"
        ? { ownerId: r.ownerId, sharePercent: Number(r.share || 0) }
        : { ownerName: r.name, ownerPhone: r.phone || null, sharePercent: Number(r.share || 0) },
    );

    // Grace period (days) after the rent due date before rent becomes overdue.
    const graceRaw = fd.get("rentGraceDays");
    const rentGraceDays =
      graceRaw === null || graceRaw === ""
        ? PROPERTY_RENT_GRACE_DAYS_DEFAULT
        : Math.min(90, Math.max(0, Math.floor(Number(graceRaw)))) || PROPERTY_RENT_GRACE_DAYS_DEFAULT;

    const payload: Record<string, unknown> = {
      name: fd.get("name"),
      type: fd.get("type"),
      address: fd.get("address"),
      location: fd.get("location"),
      rent: rentAmount === "" ? undefined : Number(rentAmount),
      remarks,
      isOwnStay,
      unitTags: unitTags || null,
      utilityDeposit: utilityDeposit === "" ? 0 : Number(utilityDeposit),
      rentStartDate: fd.get("rentStartDate") || null,
      rentGraceDays,
      status,
      soldDate: status === "SOLD" ? soldDate || null : null,
      owners: ownersPayload,
      tenantName: tenantName || null,
      tenantPhone: tenantPhone || null,
      tenantLanguage: tenantLanguage || null,
      monthlyRent: rentAmount === "" ? undefined : Number(rentAmount),
      deposit: fd.get("deposit"),
      startDate: fd.get("startDate") || null,
      // Open-ended lease → no end date; otherwise send the chosen date (or none).
      endDate: openEnded ? null : fd.get("endDate") || null,
      openEnded,
    };

    try {
      const url = isEdit ? `/api/properties/${property!.id}` : "/api/properties";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "PLAN_LIMIT") setLimitHit(true);
        throw new Error(data?.error ?? "Failed to save property.");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the property. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="card w-full max-w-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">{isEdit ? `Edit Property — ${property!.name}` : "Add New Property Unit"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Property name" name="name" required defaultValue={property?.name} placeholder="e.g. Apt 8C, KLCC" />
          <Field label="Type" name="type" select required defaultValue={property?.type}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Field>
          <Field label="Address" name="address" defaultValue={property?.address} placeholder="Street address" />
          <Field label="Location" name="location" defaultValue={property?.location} placeholder="e.g. TTDI, KL" />
          <div className="sm:col-span-2">
            <label className="label mb-1">
              Remarks <span className="normal-case text-slate-400">({remarks.length}/{PROPERTY_MAX_REMARKS})</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value.slice(0, PROPERTY_MAX_REMARKS))}
              rows={2}
              className="input resize-none"
              placeholder="Notes about this unit, e.g. key handover, maintenance, tenancy quirks, etc."
            />
          </div>

          <div>
            <label className="label mb-1">Rent (RM)</label>
            <input name="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="input" placeholder="1500" />
          </div>
          <div>
            <label className="label mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input cursor-pointer">
              {PROPERTY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label mb-1">Rent collection start date</label>
                <input
                  name="rentStartDate"
                  type="date"
                  defaultValue={property?.rentStartDate ? property.rentStartDate.slice(0, 10) : undefined}
                  className="input cursor-pointer"
                />
              </div>
              <div>
                <label className="label mb-1">Grace period (days)</label>
                <input
                  name="rentGraceDays"
                  type="number"
                  min={0}
                  max={90}
                  defaultValue={property ? String(property.rentGraceDays) : String(PROPERTY_RENT_GRACE_DAYS_DEFAULT)}
                  className="input"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Days after the rent due date before unpaid rent is treated as overdue.
                </p>
              </div>
            </div>
          </div>
          {status === "SOLD" && (
            <div>
              <label className="label mb-1">
                Sold date <span className="normal-case text-slate-400">(required for record keeping)</span>
              </label>
              <input
                type="date"
                value={soldDate}
                onChange={(e) => setSoldDate(e.target.value)}
                className="input cursor-pointer"
              />
            </div>
          )}

          {/* Own Stay */}
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <input
                type="checkbox"
                checked={isOwnStay}
                onChange={(e) => setIsOwnStay(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">Own Stay</span> — the owner stays in this unit. There is{" "}
                <span className="font-semibold text-slate-700">no rental collection</span>, and it is{" "}
                <span className="font-semibold text-slate-700">excluded from Tax &amp; Audit</span> (own-stay expenses
                cannot offset rental income). Bills can still be tracked.
              </span>
            </label>
          </div>

          {/* Owners */}
          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Owners & share %</p>
              <div className="flex items-center gap-3">
                <span
                  className={cx(
                    "text-xs font-bold",
                    shareExceeded ? "text-red-500" : totalShare === 100 ? "text-emerald-600" : "text-slate-500",
                  )}
                >
                  Total: {totalShare}%
                </span>
                <button type="button" onClick={addRow} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-primary transition hover:bg-slate-100">
                  <i className="fa-solid fa-plus mr-1" /> Add owner
                </button>
              </div>
            </div>

            {shareExceeded && (
              <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">
                <i className="fa-solid fa-triangle-exclamation mr-1" /> Total share exceeds 100%.
              </p>
            )}

            <div className="space-y-2">
              {ownerRows.map((row) => {
                const selected = owners.find((o) => o.id === row.ownerId);
                return (
                  <div key={row.key} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-blue-100 text-[10px] font-bold text-blue-700">
                      {selected?.name ? initials(selected.name) : "?"}
                    </span>
                    <select
                      value={row.mode}
                      onChange={(e) => updateRow(row.key, { mode: e.target.value as OwnerRow["mode"] })}
                      className="input cursor-pointer sm:w-32"
                    >
                      <option value="existing">Existing</option>
                      <option value="new">New owner</option>
                    </select>
                    {row.mode === "existing" ? (
                      <select
                        value={row.ownerId}
                        onChange={(e) => {
                          const o = owners.find((x) => x.id === e.target.value);
                          updateRow(row.key, { ownerId: e.target.value, name: o?.name ?? "" });
                        }}
                        className="input flex-1 cursor-pointer"
                      >
                        <option value="">— Select owner —</option>
                        {owners.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={row.name}
                        onChange={(e) => updateRow(row.key, { name: e.target.value })}
                        placeholder="New owner name"
                        className="input flex-1"
                      />
                    )}
                    <input
                      value={row.share}
                      onChange={(e) => updateRow(row.key, { share: e.target.value })}
                      type="number"
                      min={0}
                      max={100}
                      placeholder="%"
                      className="input sm:w-24"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={ownerRows.length === 1}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                      title="Remove owner"
                    >
                      <i className="fa-solid fa-trash-can text-sm" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tenant & lease (optional) — includes utility deposit, unit tags and
              default meter mode (previously their own section). Rental deposit
              and utility deposit are clearly distinguished. */}
          <div className="sm:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Tenant & lease (optional)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label mb-1">Tenant name</label>
                <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="input" placeholder="Full name" />
              </div>
              <div>
                <label className="label mb-1">Tenant phone</label>
                <input
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  onBlur={() => setTenantPhone((v) => normalizePhoneE164(v) ?? v)}
                  className="input"
                  placeholder="01x-xxx-xxxx (auto-converted to +60…)"
                />
              </div>
              <div>
                <label className="label mb-1">Tenant language (WhatsApp)</label>
                <select
                  value={tenantLanguage}
                  onChange={(e) => setTenantLanguage(e.target.value)}
                  className="input cursor-pointer"
                >
                  {SUPPORTED_LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.native}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label mb-1">Monthly rent (RM)</label>
                <input name="monthlyRent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="input" />
              </div>
              <Field label="Rental deposit (RM)" name="deposit" type="number" defaultValue={property?.lease ? String(property.lease.deposit) : undefined} />
              <div>
                <label className="label mb-1">Utility deposit (RM)</label>
                <input
                  value={utilityDeposit}
                  onChange={(e) => setUtilityDeposit(e.target.value)}
                  type="number"
                  min={0}
                  className="input"
                  placeholder="e.g. 400"
                />
              </div>
              <div>
                <label className="label mb-1">
                  Unit tags <span className="normal-case text-slate-400">(comma-separated)</span>
                </label>
                <input
                  value={unitTags}
                  onChange={(e) => setUnitTags(e.target.value.slice(0, PROPERTY_UNIT_TAGS_MAX))}
                  className="input"
                  placeholder="e.g. Female Only, Private Bathroom"
                />
              </div>
              <div>
                <label className="label mb-1">Lease start date</label>
                <input name="startDate" type="date" defaultValue={property?.lease?.startDate.slice(0, 10)} className="input cursor-pointer" />
              </div>
              <div>
                <label className="label mb-1">Lease end date</label>
                <input
                  name="endDate"
                  type="date"
                  disabled={openEnded}
                  defaultValue={property?.lease?.endDate?.slice(0, 10)}
                  className="input cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                />
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={openEnded}
                    onChange={(e) => setOpenEnded(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>Open-ended lease — until further notice (no end date)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 pb-2">
            <p className="text-sm font-medium text-red-500">{error}</p>
            {limitHit && (
              <a
                href="/subscription"
                className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                <i className="fa-solid fa-crown" /> Upgrade my plan
              </a>
            )}
          </div>
        )}

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving || shareExceeded} className="btn-primary">
            {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : isEdit ? "Update property" : "Save property"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  select,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  select?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="label mb-1">{label}</label>
      {select ? (
        <select name={name} required={required} className="input cursor-pointer">
          {children}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="input"
        />
      )}
    </div>
  );
}
