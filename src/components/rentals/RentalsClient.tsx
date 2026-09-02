"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cx, formatMYR, formatDate } from "@/lib/format";
import { RENT_GRACE_DAYS, type RentalCollectionItem, type RentalPaymentDTO } from "@/lib/rentals";

/** An unpaid month is overdue only after the due date plus the grace period. */
function isOverdue(payment: RentalPaymentDTO, now = new Date()): boolean {
  if (payment.status === "PAID") return false;
  const graceEnd = new Date(payment.dueDate);
  graceEnd.setDate(graceEnd.getDate() + RENT_GRACE_DAYS);
  return now > graceEnd;
}

/**
 * Unpaid and PAST the due date but still inside the grace window. Rent that is
 * not yet due (due date still in the future) is NOT "in grace" — grace only
 * begins once the due date has passed.
 */
function isInGrace(payment: RentalPaymentDTO, now = new Date()): boolean {
  if (payment.status === "PAID") return false;
  const due = new Date(payment.dueDate);
  const graceEnd = new Date(due);
  graceEnd.setDate(graceEnd.getDate() + RENT_GRACE_DAYS);
  return now >= due && now <= graceEnd;
}

export function RentalsClient({ rentals }: { rentals: RentalCollectionItem[] }) {
  const router = useRouter();
  const [paying, setPaying] = useState<{ lease: RentalCollectionItem; payment: RentalPaymentDTO } | null>(null);
  // When there are more than 4 properties, only the latest 3 are expanded by
  // default; the rest are collapsed. Clicking a card header expands/collapses it.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => (rentals.length > 4 ? new Set(rentals.slice(3).map((l) => l.id)) : new Set<string>()),
  );

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const overdue = rentals.reduce(
    (sum, l) => sum + l.payments.filter((p) => p.status === "UNPAID" && isOverdue(p)).reduce((a, p) => a + p.amount, 0),
    0,
  );
  const dueSoon = rentals.reduce(
    (sum, l) => sum + l.payments.filter((p) => p.status === "UNPAID" && !isOverdue(p)).reduce((a, p) => a + p.amount, 0),
    0,
  );
  const collected = rentals.reduce(
    (sum, l) => sum + l.payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0),
    0,
  );
  const unpaidCount = rentals.reduce((sum, l) => sum + l.payments.filter((p) => p.status === "UNPAID").length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Rental Collection</h3>
          <p className="text-sm text-slate-500">
            Monthly rent records per leased property. Payment slips are required to record rent as collected.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-xs leading-relaxed text-sky-800">
        <i className="fa-solid fa-circle-info mt-0.5 text-sky-500" />
        <span>
          Any rent payment is always applied to the <span className="font-bold">earliest unpaid month</span> first.
          Months are shown <span className="font-bold">newest first</span>.
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Metric icon="fa-triangle-exclamation" cls="bg-red-50 text-red-500" label="Overdue (RM)" value={formatMYR(overdue)} />
        <Metric icon="fa-hourglass-half" cls="bg-amber-50 text-amber-500" label="Due / In grace (RM)" value={formatMYR(dueSoon)} />
        <Metric icon="fa-hand-holding-dollar" cls="bg-emerald-50 text-emerald-500" label="Collected (RM)" value={formatMYR(collected)} />
      </div>

      {rentals.length === 0 && (
        <div className="card p-12 text-center text-slate-500">
          <i className="fa-solid fa-hand-holding-dollar mb-3 text-4xl text-slate-300" />
          <p className="text-lg font-medium">No active leases to collect.</p>
        </div>
      )}

      {rentals.map((lease) => {
        const leaseOverdue = lease.payments.filter((p) => p.status === "UNPAID" && isOverdue(p));
        const leaseInGrace = lease.payments.filter((p) => p.status === "UNPAID" && isInGrace(p));
        const leaseUpcoming = lease.payments.filter(
          (p) => p.status === "UNPAID" && !isOverdue(p) && !isInGrace(p),
        );
        const isCollapsed = collapsed.has(lease.id);
        return (
          <div key={lease.id} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCollapsed(lease.id)}
              className={cx(
                "flex w-full flex-wrap items-center justify-between gap-3 border-b px-6 py-4 text-left transition hover:brightness-[0.98]",
                leaseOverdue.length ? "bg-red-50/40 border-red-100"
                  : leaseInGrace.length ? "bg-amber-50/40 border-amber-100"
                  : leaseUpcoming.length ? "bg-sky-50/40 border-sky-100"
                  : "bg-emerald-50/40 border-emerald-100",
              )}
            >
              <div className="flex items-center gap-3">
                <i className={cx("fa-solid fa-building text-xl", leaseOverdue.length ? "text-red-500" : leaseInGrace.length ? "text-amber-500" : leaseUpcoming.length ? "text-sky-600" : "text-emerald-600")} />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900">{lease.propertyName}</h4>
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">{lease.propertyType}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    Tenant: {lease.tenantName} · Monthly rent: {formatMYR(lease.monthlyRent)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {leaseOverdue.length ? (
                  <span className="pill bg-red-100 text-red-700"><i className="fa-solid fa-triangle-exclamation" /> {leaseOverdue.length} overdue</span>
                ) : leaseInGrace.length ? (
                  <span className="pill bg-amber-100 text-amber-700"><i className="fa-solid fa-hourglass-half" /> {leaseInGrace.length} in grace</span>
                ) : leaseUpcoming.length ? (
                  <span className="pill bg-sky-100 text-sky-700"><i className="fa-solid fa-calendar-day" /> {leaseUpcoming.length} due</span>
                ) : (
                  <span className="pill bg-emerald-100 text-emerald-700"><i className="fa-solid fa-check-circle" /> All Collected</span>
                )}
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                  <i className={cx("fa-solid transition-transform", isCollapsed ? "fa-chevron-down" : "fa-chevron-up")} />
                </span>
              </div>
            </button>

            {isCollapsed ? (
              <p className="px-6 py-4 text-xs text-slate-400">
                <i className="fa-regular fa-eye-slash mr-1" />
                {lease.payments.length} rent month{lease.payments.length === 1 ? "" : "s"} — click the header to expand.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {lease.payments.map((payment) => (
                  <RentalRow
                    key={payment.id}
                    payment={payment}
                    onOpen={() => setPaying({ lease, payment })}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {paying && (
        <RentalPaymentModal
          lease={paying.lease}
          payment={paying.payment}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RentalRow({ payment, onOpen }: { payment: RentalPaymentDTO; onOpen: () => void }) {
  const paid = payment.status === "PAID";
  const overdue = isOverdue(payment);
  const inGrace = isInGrace(payment);
  return (
    <div className={cx("flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between", paid ? "bg-emerald-50/20" : overdue ? "bg-red-50/20" : inGrace ? "bg-amber-50/20" : "bg-slate-50/40")}>
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800">
          {payment.label}
          {payment.overridden && (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700" title="Confirmed by a Property Manager without a payment slip">
              <i className="fa-solid fa-user-shield mr-1" /> No slip
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {payment.remarks ? ` ${payment.remarks} ·` : ""} Due {formatDate(payment.dueDate)}
          {!paid && inGrace && <span className="font-semibold text-amber-600"> · in grace</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-bold text-slate-700">{formatMYR(payment.amount)}</span>
        {paid ? (
          <span className="pill bg-emerald-100 text-emerald-700">
            <i className="fa-solid fa-check-circle" /> Paid{payment.paidAt ? ` · ${formatDate(payment.paidAt)}` : ""}
          </span>
        ) : overdue ? (
          <span className="pill bg-red-100 text-red-700">
            <i className="fa-solid fa-triangle-exclamation" /> Overdue
          </span>
        ) : inGrace ? (
          <span className="pill bg-amber-100 text-amber-700">
            <i className="fa-solid fa-hourglass-half" /> Due · in grace
          </span>
        ) : (
          <span className="pill bg-slate-100 text-slate-600">
            <i className="fa-solid fa-calendar-day" /> Due
          </span>
        )}

        {payment.receiptUrl ? (
          <a href={payment.receiptUrl} download target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50">
            <i className="fa-solid fa-receipt mr-1" /> Slip
          </a>
        ) : paid ? (
          <span className="rounded-lg border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400">No slip</span>
        ) : null}

        <button onClick={onOpen} className={cx("rounded-lg px-3 py-1.5 text-xs font-bold transition", paid ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100" : "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600")}>
          <i className={cx("fa-solid mr-1", paid ? "fa-pen" : "fa-check")} /> {paid ? "Edit" : "Default"}
        </button>
      </div>
    </div>
  );
}

function Metric({ icon, cls, label, value }: { icon: string; cls: string; label: string; value: string }) {
  return (
    <div className="card flex items-center justify-between p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
      </div>
      <div className={cx("grid h-12 w-12 place-items-center rounded-full text-xl", cls)}>
        <i className={`fa-solid ${icon}`} />
      </div>
    </div>
  );
}

/** Mark a rent record as collected — payment slip required, or a PM override. */
function RentalPaymentModal({
  lease,
  payment,
  onClose,
  onSaved,
}: {
  lease: RentalCollectionItem;
  payment: RentalPaymentDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isPaid = payment.status === "PAID";
  const [status, setStatus] = useState<"PAID" | "UNPAID">("PAID");
  // The "Default" collection always starts from one month's rent
  // (lease.monthlyRent) and can be edited here. When editing a month that was
  // already collected, keep its recorded amount instead.
  const [amount, setAmount] = useState<string>(() =>
    isPaid && payment.amount ? String(payment.amount) : String(lease.monthlyRent),
  );
  const [remarks, setRemarks] = useState(payment.remarks ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("status", status);
    if (amount) fd.set("amount", amount);
    fd.set("remarks", remarks);
    if (file) fd.set("file", file);
    if (override) fd.set("override", "true");

    // Payment slip mandatory when collecting — unless the PM confirms the override.
    if (status === "PAID" && !file && !payment.receiptUrl && !override) {
      setError(
        "A payment slip is required to record this rent. Upload a PDF/image, or tick the Property Manager override confirmation.",
      );
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/rentals/${payment.id}`, { method: "PATCH", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save rental record.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the rental record.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            {payment.label} — {lease.propertyName}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        <div className="grid gap-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx("pill", status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700")}>
              {status === "PAID" ? "Collect rent" : "Save as unpaid"}
            </span>
            <select value={status} onChange={(e) => setStatus(e.target.value as "PAID" | "UNPAID")} className="input cursor-pointer">
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid (draft)</option>
            </select>
          </div>

          <div>
            <label className="label mb-1">Amount (RM)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0.00" />
            {!isPaid && (
              <p className="mt-1 text-xs text-slate-400">
                Defaults to one month's rent ({formatMYR(lease.monthlyRent)}). You can enter a different amount.
              </p>
            )}
          </div>

          <div>
            <label className="label mb-1">
              Remarks <span className="normal-case text-slate-400">({remarks.length}/500)</span>
            </label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value.slice(0, 500))} rows={2} className="input resize-none" placeholder="Payment notes, reference, etc." />
          </div>

          {status === "PAID" && (
            <>
              <div>
                <label className="label mb-1">
                  Payment slip <span className="text-red-500">(required when collecting)</span>
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="input file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
                />
                {isPaid && payment.receiptUrl && (
                  <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
                    <i className="fa-solid fa-receipt" /> Existing slip on file
                  </a>
                )}
              </div>

              <label className={cx("flex cursor-pointer items-start gap-3 rounded-xl border p-3", override ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50/60")}>
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
                <span className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Property Manager override</span> — no payment slip available; I confirm this rent was collected.
                </span>
              </label>
            </>
          )}
        </div>

        {error && <p className="px-6 pb-2 text-sm font-medium text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary">
            {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : status === "PAID" ? "Confirm collection" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
