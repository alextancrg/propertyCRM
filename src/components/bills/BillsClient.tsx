"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cx, formatMYR, formatDate } from "@/lib/format";
import { SCHEDULE_DATE_COUNTS, BILL_MAX_REMARKS, BILL_SCHEDULES, BILL_TYPES, BILL_RECEIPT_MAX, seweragePrepaySummary, type BillSchedule } from "@/lib/bills";
import { PROPERTY_TYPES } from "@/lib/properties";

type ReceiptDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
};

type PaymentDTO = {
  id: string;
  cycle: string;
  dueDate: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
  receiptUrl: string | null;
  receipts: ReceiptDTO[];
  remarks: string | null;
};

type BillDTO = {
  id: string;
  type: string;
  provider: string;
  schedule: string;
  amountType: string;
  fixedAmount: number | null;
  year: number;
  dueDates: string[];
  remarks: string | null;
  tenantPrepaid: boolean;
  tenantPrepayAmount: number | null;
  tenantPrepayNote: string | null;
  payments: PaymentDTO[];
};

type PropertyDTO = {
  id: string;
  name: string;
  type: string;
  status: string;
  owners: string;
  activeLease: {
    id: string;
    startDate: string;
    endDate: string | null;
    monthlyRent: number;
  } | null;
  bills: BillDTO[];
};

const BILL_ICON: Record<string, { icon: string; cls: string }> = {
  Electricity: { icon: "fa-bolt", cls: "bg-yellow-100 text-yellow-600" },
  Water: { icon: "fa-droplet", cls: "bg-blue-50 text-blue-500" },
  Sewerage: { icon: "fa-sink", cls: "bg-slate-100 text-slate-500" },
  "Management Fee": { icon: "fa-building-user", cls: "bg-blue-100 text-blue-600" },
  "Quit Rent": { icon: "fa-landmark", cls: "bg-amber-100 text-amber-600" },
  "Assessment Tax": { icon: "fa-receipt", cls: "bg-violet-100 text-violet-600" },
  "Repairs & Renovation": { icon: "fa-hammer", cls: "bg-orange-100 text-orange-600" },
  "Fire Insurance": { icon: "fa-fire-flame-curved", cls: "bg-red-100 text-red-600" },
  Miscellaneous: { icon: "fa-shapes", cls: "bg-teal-100 text-teal-600" },
};

export function BillsClient({ properties }: { properties: PropertyDTO[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<BillDTO | null>(null);
  // Per-property expand/collapse (default expanded).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return properties.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q);
      const matchT = typeFilter === "All" || p.type === typeFilter;
      return matchQ && matchT;
    });
  }, [properties, query, typeFilter]);

  const totalUnpaid = properties.reduce(
    (sum, p) => sum + p.bills.reduce((s, b) => s + b.payments.filter((x) => x.status === "UNPAID").length, 0),
    0,
  );
  const totalPaid = properties.reduce(
    (sum, p) =>
      sum +
      p.bills.reduce(
        (s, b) => s + b.payments.filter((x) => x.status === "PAID").reduce((a, x) => a + x.amount, 0),
        0,
      ),
    0,
  );
  const cleared = properties.filter(
    (p) => p.bills.length > 0 && p.bills.every((b) => b.payments.length > 0 && b.payments.every((x) => x.status === "PAID")),
  ).length;

  function openAdd() {
    setEditingBill(null);
    setShowModal(true);
  }
  function openEdit(b: BillDTO) {
    setEditingBill(b);
    setShowModal(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Utility Payment Dashboard</h3>
          <p className="text-sm text-slate-500">Track recurring bills, due dates and upload payment evidence for tax deductions.</p>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
            <i className="fa-solid fa-circle-info mr-1 text-primary" />
            These bills are not managed by tenants — they are settled by the property owners / managers. Typical
            owner-managed bills: <span className="font-medium text-slate-600">Miscellaneous, Sewerage, Management Fees, Assessment Tax, Quit Rent, Repairs &amp; Renovations</span>.
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start sm:self-auto">
          <i className="fa-solid fa-gear" /> Configure Bill
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Metric icon="fa-file-circle-exclamation" cls="bg-orange-50 text-orange-500" label="Total Unpaid Bills" value={String(totalUnpaid)} />
        <Metric icon="fa-check-double" cls="bg-emerald-50 text-emerald-500" label="Total Paid" value={formatMYR(totalPaid)} />
        <Metric icon="fa-building-circle-check" cls="bg-blue-50 text-blue-500" label="Cleared Properties" value={`${cleared} / ${properties.length}`} />
      </div>

      {/* Search */}
      <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bills by property…" className="input pl-11" />
        </div>
        <div className="relative md:w-64">
          <i className="fa-solid fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input pl-9 cursor-pointer">
            <option>All</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Property groups */}
      <div className="space-y-6">
        {filtered.map((p) => {
          const unpaid = p.bills.reduce((s, b) => s + b.payments.filter((x) => x.status === "UNPAID").length, 0);
          const allCleared = p.bills.length > 0 && unpaid === 0;
          const isCollapsed = collapsed.has(p.id);
          return (
            <div key={p.id} className={cx("card overflow-hidden", allCleared && "border-emerald-200")}>
              <button
                type="button"
                onClick={() => toggleCollapsed(p.id)}
                className={cx(
                  "flex w-full flex-wrap items-center justify-between gap-3 border-b px-6 py-4 text-left transition hover:brightness-[0.98]",
                  allCleared ? "bg-emerald-50/40 border-emerald-100" : "bg-slate-50 border-slate-200",
                )}
              >
                <div className="flex items-center gap-3">
                  <i className={cx("fa-solid text-xl", allCleared ? "fa-city text-emerald-600" : "fa-building text-primary")} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900">{p.name}</h4>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">{p.type}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500">Owner: {p.owners} · {p.bills.length} configured bills</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {allCleared ? (
                    <span className="pill bg-emerald-100 text-emerald-700">
                      <i className="fa-solid fa-shield-check" /> All Cleared
                    </span>
                  ) : (
                    <span className="pill bg-orange-100 text-orange-700">{unpaid} Unpaid</span>
                  )}
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                    <i className={cx("fa-solid transition-transform", isCollapsed ? "fa-chevron-down" : "fa-chevron-up")} />
                  </span>
                </div>
              </button>

              {isCollapsed ? (
                <p className="px-6 py-4 text-xs text-slate-400">
                  <i className="fa-regular fa-eye-slash mr-1" />
                  {p.bills.length} bill{p.bills.length === 1 ? "" : "s"} — click the header to expand.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {p.bills.map((b) => (
                    <BillBlock key={b.id} bill={b} onEdit={() => openEdit(b)} onSaved={router.refresh} />
                  ))}
                  {p.bills.length === 0 && (
                    <p className="px-6 py-6 text-sm text-slate-400">No bills configured yet.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <BillFormModal
          propertyOptions={properties}
          bill={editingBill}
          onClose={() => {
            setShowModal(false);
            setEditingBill(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditingBill(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** A single configured bill and its per-cycle payments. */
function BillBlock({ bill, onEdit, onSaved }: { bill: BillDTO; onEdit: () => void; onSaved: () => void }) {
  const meta = BILL_ICON[bill.type] ?? { icon: "fa-receipt", cls: "bg-slate-100 text-slate-500" };
  const paid = bill.payments.filter((x) => x.status === "PAID").length;
  const dueSummary = bill.dueDates.length > 0 ? bill.dueDates.map((d) => formatDate(d)).join(", ") : "—";

  return (
    <div className="bg-white px-6 py-4">
      {/* Bill header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cx("grid h-10 w-10 place-items-center rounded-lg text-lg", meta.cls)}>
            <i className={`fa-solid ${meta.icon}`} />
          </div>
          <div>
            <h5 className="text-sm font-bold text-slate-800">
              {bill.type} <span className="font-medium text-slate-400">({bill.provider})</span>
            </h5>
            <p className="text-xs text-slate-500">
              {bill.schedule} · {bill.year} · Due: {dueSummary}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill bg-slate-100 text-slate-600">
            <i className="fa-solid fa-list-check mr-1" /> {paid}/{bill.payments.length} paid
          </span>
          <button onClick={onEdit} className="btn-ghost !px-3 !py-1.5 text-xs">
            <i className="fa-solid fa-pen" /> Edit
          </button>
        </div>
      </div>

      {bill.tenantPrepaid && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700">
          <i className="fa-solid fa-sack-dollar" />
          <span className="font-bold">Tenant prepaid {formatMYR(bill.tenantPrepayAmount ?? 0)}</span>
          <span className="text-emerald-600/80">for the total sewerage over the whole lease tenure.</span>
          {bill.tenantPrepayNote && (
            <span className="w-full text-[11px] leading-relaxed text-emerald-600/70">{bill.tenantPrepayNote}</span>
          )}
        </div>
      )}

      {bill.remarks && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <i className="fa-solid fa-note-sticky mr-1 text-slate-400" /> {bill.remarks}
        </p>
      )}

      {/* Payment cycles */}
      <div className="mt-3 space-y-2">
        {bill.payments.map((pay) => (
          <PaymentRow key={pay.id} payment={pay} bill={bill} onSaved={onSaved} />
        ))}
        {bill.payments.length === 0 && <p className="text-xs italic text-slate-400">No payment cycles generated.</p>}
      </div>
    </div>
  );
}

function PaymentRow({ payment, bill, onSaved }: { payment: PaymentDTO; bill: BillDTO; onSaved: () => void }) {
  const [modal, setModal] = useState(false);
  const paid = payment.status === "PAID";

  return (
    <div className={cx("flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between", paid ? "border-emerald-100 bg-emerald-50/30" : "border-orange-100 bg-orange-50/30")}>
      <div className="flex flex-1 items-center gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{payment.cycle}</p>
          <p className="text-xs text-slate-500">
            Due {payment.dueDate ? formatDate(payment.dueDate) : "—"}
            {payment.remarks ? ` · ${payment.remarks}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-bold text-slate-700">{formatMYR(payment.amount)}</span>
        {paid ? (
          <span className="pill bg-emerald-100 text-emerald-700">
            <i className="fa-solid fa-check-circle" /> Paid {payment.paidAt ? `· ${formatDate(payment.paidAt)}` : ""}
          </span>
        ) : (
          <span className="pill bg-orange-100 text-orange-700">
            <i className="fa-solid fa-hourglass-half" /> Unpaid
          </span>
        )}

        {payment.receipts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {payment.receipts.map((r, i) => (
              <a
                key={r.id}
                href={`/api/uploads/bill-receipt/${r.id}`}
                download
                target="_blank"
                rel="noreferrer"
                title={r.fileName}
                className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <i className="fa-solid fa-receipt mr-1" />
                {payment.receipts.length === 1 ? "Receipt" : `Receipt ${i + 1}`}
              </a>
            ))}
          </div>
        ) : payment.receiptUrl ? (
          <a
            href={payment.receiptUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            <i className="fa-solid fa-receipt mr-1" /> Receipt
          </a>
        ) : paid ? (
          <span className="rounded-lg border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400">No receipt</span>
        ) : null}

        <button
          onClick={() => setModal(true)}
          className={cx(
            "rounded-lg px-3 py-1.5 text-xs font-bold transition",
            paid
              ? "border border-slate-200 bg-white text-slate-600 shadow-none hover:bg-slate-100"
              : "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600",
          )}
        >
          <i className={cx("fa-solid mr-1", paid ? "fa-pen" : "fa-check")} /> {paid ? "Edit" : "Mark Paid"}
        </button>
      </div>

      {modal && <PaymentModal payment={payment} bill={bill} onClose={() => setModal(false)} onSaved={() => { setModal(false); onSaved(); }} />}
    </div>
  );
}

/** Modal to settle a payment cycle — 1–4 receipts (min 1 when Paid) or edit remarks. */
function PaymentModal({ payment, bill, onClose, onSaved }: { payment: PaymentDTO; bill: BillDTO; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<"PAID" | "UNPAID">("PAID");
  const [amount, setAmount] = useState<string>(payment.amount ? String(payment.amount) : bill.fixedAmount ? String(bill.fixedAmount) : "");
  const [remarks, setRemarks] = useState(payment.remarks ?? "");
  const [existing, setExisting] = useState<ReceiptDTO[]>(payment.receipts ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalReceipts = existing.length + newFiles.length;
  const atMax = totalReceipts >= BILL_RECEIPT_MAX;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const additions = Array.from(list).filter((f) => f.size > 0);
    setNewFiles((prev) => [...prev, ...additions].slice(0, BILL_RECEIPT_MAX - existing.length));
  }

  function removeNewFile(index: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function removeExisting(receipt: ReceiptDTO) {
    try {
      const res = await fetch(`/api/bills/receipts/${receipt.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to remove receipt.");
      setExisting((prev) => prev.filter((r) => r.id !== receipt.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the receipt.");
    }
  }

  async function submit() {
    setSaving(true);
    setError(null);

    // At least 1 receipt (and at most 4) when marking as paid.
    if (status === "PAID" && totalReceipts < 1) {
      setError("At least one receipt upload is required to mark this bill as Paid.");
      setSaving(false);
      return;
    }
    if (totalReceipts > BILL_RECEIPT_MAX) {
      setError(`A maximum of ${BILL_RECEIPT_MAX} receipts is allowed per bill.`);
      setSaving(false);
      return;
    }

    const fd = new FormData();
    fd.set("status", status);
    if (amount) fd.set("amount", amount);
    fd.set("remarks", remarks);
    newFiles.forEach((f) => fd.append("files", f));

    try {
      const res = await fetch(`/api/bills/payments/${payment.id}`, { method: "PATCH", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save payment.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payment.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">Settle {bill.type} — {payment.cycle}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        <div className="grid gap-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx("pill", status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700")}>
              {status === "PAID" ? "Mark as Paid" : "Save as Unpaid"}
            </span>
            <select value={status} onChange={(e) => setStatus(e.target.value as "PAID" | "UNPAID")} className="input cursor-pointer">
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid (save draft)</option>
            </select>
          </div>

          <div>
            <label className="label mb-1">Amount (RM)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0.00" />
          </div>

          <div>
            <label className="label mb-1">
              Remarks <span className="normal-case text-slate-400">({remarks.length}/{BILL_MAX_REMARKS})</span>
            </label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value.slice(0, BILL_MAX_REMARKS))} rows={3} className="input resize-none" placeholder="Payment notes, reference number, etc." />
          </div>

          <div>
            <label className="label mb-1">
              Receipts{" "}
              {status === "PAID" ? (
                <span className="text-red-500">(min 1 · max {BILL_RECEIPT_MAX})</span>
              ) : (
                <span className="text-slate-400">(optional)</span>
              )}
            </label>

            {existing.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {existing.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-1.5 text-xs">
                    <a
                      href={`/api/uploads/bill-receipt/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-emerald-700 hover:underline"
                    >
                      <i className="fa-solid fa-file" />
                      <span className="truncate">{r.fileName}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => removeExisting(r)}
                      title="Remove receipt"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <i className="fa-solid fa-trash-can text-[11px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              disabled={atMax}
              onChange={(e) => addFiles(e.target.files)}
              className="input file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold disabled:opacity-40"
            />

            {newFiles.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {newFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-700">
                      <i className="fa-solid fa-file" />
                      <span className="truncate">{f.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewFile(i)}
                      title="Remove file"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className={cx("mt-1.5 text-[11px] font-medium", atMax ? "text-amber-600" : "text-slate-400")}>
              {totalReceipts}/{BILL_RECEIPT_MAX} receipts —{" "}
              {status === "PAID" ? "at least 1 required when marking as Paid." : "optional for unpaid drafts."}
            </p>
          </div>
        </div>

        {error && <p className="px-6 pb-2 text-sm font-medium text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary">
            {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : status === "PAID" ? "Confirm payment" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Shared add/edit bill form with dynamic due-date pickers per schedule. */
function BillFormModal({
  propertyOptions,
  bill,
  onClose,
  onSaved,
}: {
  propertyOptions: PropertyDTO[];
  bill: BillDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(bill);
  const [propId, setPropId] = useState<string>(() => (isEdit ? "" : propertyOptions[0]?.id ?? ""));
  const firstPropSold = propertyOptions[0]?.status === "SOLD";
  const [schedule, setSchedule] = useState(bill?.schedule ?? (firstPropSold ? "One Off" : "Monthly"));
  const [amountType, setAmountType] = useState(bill?.amountType ?? "Variable");
  const [year, setYear] = useState(bill?.year ?? new Date().getFullYear());
  const [remarks, setRemarks] = useState(bill?.remarks ?? "");
  const [dueDates, setDueDates] = useState<string[]>(() => {
    if (bill && bill.dueDates.length) return bill.dueDates;
    const count = SCHEDULE_DATE_COUNTS[schedule as keyof typeof SCHEDULE_DATE_COUNTS] ?? 1;
    return Array.from({ length: count }, () => "");
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billType, setBillType] = useState(bill?.type ?? "Electricity");
  const [fixedAmount, setFixedAmount] = useState(bill?.fixedAmount ? String(bill.fixedAmount) : "");
  const [tenantPrepaid, setTenantPrepaid] = useState(Boolean(bill?.tenantPrepaid));

  const selectedProperty = propertyOptions.find((p) => p.id === propId);
  const propSold = !isEdit && selectedProperty?.status === "SOLD";

  const dateCount = SCHEDULE_DATE_COUNTS[schedule as keyof typeof SCHEDULE_DATE_COUNTS] ?? 1;

  // Total sewerage prepayment for the whole lease tenure (Sewerage bills only).
  const prepaySummary =
    billType === "Sewerage" && tenantPrepaid
      ? selectedProperty?.activeLease
        ? seweragePrepaySummary({
            fixedAmount: Number(fixedAmount || 0),
            schedule: schedule as BillSchedule,
            leaseStart: selectedProperty.activeLease.startDate,
            leaseEnd: selectedProperty.activeLease.endDate,
            billingYear: year,
          })
        : bill?.tenantPrepayAmount
          ? {
              total: bill.tenantPrepayAmount,
              note: bill.tenantPrepayNote ?? "Tenant prepayment recorded for the whole lease tenure.",
            }
          : null
      : null;

  function changeSchedule(next: string) {
    setSchedule(next);
    const count = SCHEDULE_DATE_COUNTS[next as keyof typeof SCHEDULE_DATE_COUNTS] ?? 1;
    setDueDates((prev) => {
      const arr = prev.slice(0, count);
      while (arr.length < count) arr.push("");
      return arr;
    });
  }

  function onPropertyChange(id: string) {
    setPropId(id);
    const sold = propertyOptions.find((p) => p.id === id)?.status === "SOLD";
    // Sold properties may only have one-off bills.
    if (sold && schedule !== "One Off") changeSchedule("One Off");
  }

  function setDateAt(idx: number, val: string) {
    setDueDates((prev) => prev.map((d, i) => (i === idx ? val : d)));
  }

  const dueLabels: Record<string, string[]> = {
    Monthly: ["Due day (applies to each month)"],
    Quarterly: ["Q1 due date", "Q2 due date", "Q3 due date", "Q4 due date"],
    "Half-Yearly": ["H1 due date (first half)", "H2 due date (second half)"],
    Annually: ["Annual due date"],
    "One Off": ["Due date"],
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    if (dueDates.some((d) => !d)) {
      setError(`Please fill in all ${dateCount} due date picker${dateCount === 1 ? "" : "s"} for ${schedule}.`);
      setSaving(false);
      return;
    }

    const payload = {
      propertyId: isEdit ? undefined : fd.get("propertyId"),
      type: fd.get("type"),
      provider: fd.get("provider"),
      schedule,
      amountType: fd.get("amountType"),
      fixedAmount: fd.get("fixedAmount"),
      year: Number(year),
      dueDates,
      remarks,
      tenantPrepaid: billType === "Sewerage" ? tenantPrepaid : false,
      tenantPrepayAmount: prepaySummary?.total ?? null,
      tenantPrepayNote: prepaySummary?.note ?? null,
    };

    try {
      const url = isEdit ? `/api/bills/${bill!.id}` : "/api/bills";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save bill.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the bill.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">{isEdit ? `Edit Bill — ${bill!.type}` : "Configure Recurring Bill"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>
        <div className="grid gap-4 p-6">
          {!isEdit && (
            <div>
              <label className="label mb-1">Property</label>
              <select name="propertyId" value={propId} onChange={(e) => onPropertyChange(e.target.value)} className="input cursor-pointer">
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.status === "SOLD" ? " (Sold)" : ""}
                  </option>
                ))}
              </select>
              {propSold && (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  <i className="fa-solid fa-triangle-exclamation mr-1" />
                  Sold property — only one-off bills are allowed.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1">Bill type</label>
              <select name="type" value={billType} onChange={(e) => setBillType(e.target.value)} className="input cursor-pointer">
                {BILL_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1">Provider</label>
              <input name="provider" className="input" defaultValue={bill?.provider} placeholder="e.g. TNB" required />
            </div>
            <div>
              <label className="label mb-1">Schedule / frequency</label>
              <select value={schedule} onChange={(e) => changeSchedule(e.target.value)} className="input cursor-pointer">
                {BILL_SCHEDULES.map((s) => (
                  <option key={s} value={s} disabled={propSold && s !== "One Off"}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1">Billing year</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="input" />
            </div>
            <div>
              <label className="label mb-1">Amount tracking</label>
              <select name="amountType" value={amountType} onChange={(e) => setAmountType(e.target.value)} className="input cursor-pointer">
                <option value="Variable">Variable (manual)</option>
                <option value="Fixed">Fixed amount</option>
              </select>
            </div>
            {amountType === "Fixed" && (
              <div>
                <label className="label mb-1">Fixed amount (RM)</label>
                <input name="fixedAmount" type="number" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} className="input" placeholder="650" />
              </div>
            )}
          </div>

          {/* Due date pickers */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Bill due date{dateCount > 1 ? "s" : ""} — {schedule} requires {dateCount} date{dateCount === 1 ? "" : "s"}
            </p>
            <div className="mt-3 grid gap-3">
              {dueDates.map((d, i) => (
                <div key={i}>
                  <label className="label mb-1">{dueLabels[schedule]?.[i] ?? `Due date ${i + 1}`}</label>
                  <input type="date" value={d} onChange={(e) => setDateAt(i, e.target.value)} className="input cursor-pointer" />
                </div>
              ))}
            </div>
          </div>

          {/* Sewerage tenant prepayment — total sewerage for the whole lease tenure */}
          {billType === "Sewerage" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={tenantPrepaid}
                  onChange={(e) => setTenantPrepaid(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span className="text-xs leading-relaxed text-slate-700">
                  <span className="font-bold text-slate-800">Collect a prepayment from the tenant</span> for the total
                  sewerage over the entire lease tenure.
                </span>
              </label>
              {tenantPrepaid && prepaySummary ? (
                <div className="mt-3 rounded-lg bg-white p-3 text-xs text-emerald-700">
                  <p className="font-bold">Total prepayment: {formatMYR(prepaySummary.total)}</p>
                  <p className="mt-1 leading-relaxed text-emerald-600/90">{prepaySummary.note}</p>
                </div>
              ) : tenantPrepaid ? (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                  <i className="fa-solid fa-triangle-exclamation mr-1" />
                  Set a fixed amount and ensure the property has an active lease to compute the prepayment total.
                </p>
              ) : null}
            </div>
          )}

          <div>
            <label className="label mb-1">
              Remarks <span className="normal-case text-slate-400">({remarks.length}/{BILL_MAX_REMARKS})</span>
            </label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value.slice(0, BILL_MAX_REMARKS))} rows={3} className="input resize-none" placeholder="Notes about this bill, reference, etc." />
          </div>
        </div>
        {error && <p className="px-6 pb-2 text-sm font-medium text-red-500">{error}</p>}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : isEdit ? "Update bill" : "Save configuration"}</button>
        </div>
      </form>
    </div>,
    document.body,
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
