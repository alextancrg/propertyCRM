"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cx, formatMYR, formatDate, initials } from "@/lib/format";
import { PROPERTY_TYPES, PROPERTY_MAX_REMARKS } from "@/lib/properties";
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
  rentStartDate: string | null;
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
  } | null;
};

type OwnerDTO = { id: string; name: string; phone: string | null };

const STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  LEASED: { label: "Leased", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-check-circle" },
  ARREARS: { label: "Arrears", cls: "bg-red-100 text-red-700 border-red-200", icon: "fa-triangle-exclamation" },
  VACANT: { label: "Vacant", cls: "bg-slate-100 text-slate-600 border-slate-200", icon: "fa-bed" },
  SOLD: { label: "Sold", cls: "bg-slate-800 text-white border-slate-800", icon: "fa-handshake" },
};

const PROPERTY_STATUSES = ["VACANT", "LEASED", "ARREARS", "SOLD"];

function leaseInYear(p: PropertyDTO, year: number): boolean {
  const l = p.lease;
  if (!l) return false;
  const startY = new Date(l.startDate).getFullYear();
  const endY = l.endDate ? new Date(l.endDate).getFullYear() : Infinity;
  return startY <= year && year <= endY;
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
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PropertyDTO | null>(null);
  const [deleting, setDeleting] = useState<PropertyDTO | null>(null);

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
      const matchY = yearFilter === "all" || leaseInYear(p, Number(yearFilter));
      return matchQ && matchT && matchY;
    });
  }, [properties, query, typeFilter, yearFilter]);

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
          <h3 className="text-xl font-bold text-slate-900">Property Database</h3>
          <p className="text-sm text-slate-500">Manage units, ownership, tenants, and lease compliance.</p>
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
      </div>

      {/* Grid */}
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const st = STATUS[p.status] ?? STATUS.VACANT;
            return (
              <div
                key={p.id}
                className={cx(
                  "card relative flex flex-col overflow-hidden transition hover:shadow-lift",
                  p.status === "ARREARS" && "border-red-200",
                )}
              >
                {p.status === "ARREARS" && <div className="absolute inset-x-0 top-0 h-1 bg-red-500" />}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{p.name}</h4>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          {p.type}
                        </span>
                        {p.isOwnStay && (
                          <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                            <i className="fa-solid fa-house-user mr-0.5" /> Own Stay
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          <i className="fa-solid fa-location-dot mr-1" />
                          {p.location}
                        </span>
                      </div>
                    </div>
                    <span className={cx("pill border", st.cls)}>
                      <i className={`fa-solid ${st.icon} text-[10px]`} /> {st.label}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <InfoBlock label="Ownership">
                      {p.owners.map((o) => (
                        <div key={o.ownerId ?? o.name} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="grid h-7 w-7 place-items-center rounded bg-blue-100 text-[10px] font-bold text-blue-700">
                              {initials(o.name)}
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{o.name}</p>
                              {o.phone && <p className="text-[11px] text-slate-500">{o.phone}</p>}
                            </div>
                          </div>
                          <span className="text-xs font-bold text-blue-700">{o.sharePercent}%</span>
                        </div>
                      ))}
                      {p.owners.length === 0 && <p className="text-xs italic text-slate-400">No owners recorded</p>}
                    </InfoBlock>

                    <InfoBlock label="Current Tenant">
                      {p.tenant ? (
                        <div className="flex items-center gap-2">
                          <div className="grid h-7 w-7 place-items-center rounded bg-purple-100 text-[10px] font-bold text-purple-700">
                            {initials(p.tenant.name)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{p.tenant.name}</p>
                            {p.tenant.phone && <p className="text-[11px] text-slate-500">{p.tenant.phone}</p>}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs italic text-slate-400">No active tenant</p>
                      )}
                    </InfoBlock>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-500">
                          {p.status === "VACANT" ? "Rent" : "Monthly rent"}
                        </span>
                        <span className="font-bold text-slate-900">{formatMYR(p.monthlyRent ?? p.rent)}</span>
                      </div>
                      {p.lease && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Tenancy period</span>
                          <span className="font-semibold text-slate-600">
                            {formatDate(p.lease.startDate)} – {p.lease.endDate ? formatDate(p.lease.endDate) : "Open"}
                          </span>
                        </div>
                      )}
                      {p.rentStartDate && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Rent collection start</span>
                          <span className="font-semibold text-slate-600">{formatDate(p.rentStartDate)}</span>
                        </div>
                      )}
                      {p.soldDate && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Sold date</span>
                          <span className="font-semibold text-slate-600">{formatDate(p.soldDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {p.remarks && (
                    <InfoBlock label="Remarks">
                      <p className="text-xs leading-relaxed text-slate-600">{p.remarks}</p>
                    </InfoBlock>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-slate-100 bg-slate-50/60 p-4">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    <i className="fa-solid fa-pen mr-1" /> Edit
                  </button>
                  <Link
                    href="/documents"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    <i className="fa-solid fa-folder-open mr-1" /> Docs
                  </Link>
                  <button
                    onClick={() => setDeleting(p)}
                    className="rounded-lg border border-red-200 bg-white px-2 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <i className="fa-solid fa-trash-can mr-1" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
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

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
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

    const payload: Record<string, unknown> = {
      name: fd.get("name"),
      type: fd.get("type"),
      address: fd.get("address"),
      location: fd.get("location"),
      rent: rentAmount === "" ? undefined : Number(rentAmount),
      remarks,
      isOwnStay,
      rentStartDate: fd.get("rentStartDate") || null,
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
            <label className="label mb-1">Rent collection start date</label>
            <input
              name="rentStartDate"
              type="date"
              defaultValue={property?.rentStartDate ? property.rentStartDate.slice(0, 10) : undefined}
              className="input cursor-pointer"
            />
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

          {/* Tenant & lease */}
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
              <Field label="Deposit (RM)" name="deposit" type="number" defaultValue={property?.lease ? String(property.lease.deposit) : undefined} />
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
