"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cx, formatMYR, formatDate } from "@/lib/format";

type ExpenseItem = { id: string; category: string; description: string; amount: number };
type Receipt = { id: string; label: string; url: string | null; paidAt: string | null };

type TaxProperty = {
  id: string;
  name: string;
  sharePercent: number;
  gross: number;
  grossCollected: number;
  manualRent: number;
  expenses: number;
  billExpenses: number;
  net: number;
  share: number;
  hasIncome: boolean;
  expenseItems: ExpenseItem[];
  manualExpenseItems: ExpenseItem[];
  receipts: Receipt[];
};

type OwnerYear = { year: number; totalNet: number; properties: TaxProperty[] };

type Statement = {
  id: string;
  name: string;
  icNumber: string | null;
  years: OwnerYear[];
};

type AuditDTO = {
  id: string;
  action: string;
  entityType: string;
  description: string;
  createdAt: string;
  userName: string | null;
};

export function TaxClient({
  statements,
  years,
  auditLogs,
}: {
  statements: Statement[];
  years: number[];
  auditLogs: AuditDTO[];
}) {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState(statements[0]?.id ?? "");
  const [year, setYear] = useState<number>(years[0] ?? new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<{ property: TaxProperty; year: number } | null>(null);
  const [query, setQuery] = useState("");

  const owner = statements.find((s) => s.id === ownerId) ?? statements[0];
  const yr = owner?.years.find((y) => y.year === year);
  const filteredProperties = (yr?.properties ?? []).filter(
    (p) => !query || p.name.toLowerCase().includes(query.toLowerCase()),
  );

  async function exportPdf() {
    if (!owner || !yr) return;
    setExporting(true);
    try {
      const res = await fetch("/api/tax/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: owner.id, year: yr.year }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `efiling-${owner.name.replace(/[^a-zA-Z0-9]+/g, "-")}-${yr.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + owner/year selector + export */}
      <div className="card flex flex-col gap-4 p-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Owner Income Tax Statements (LHDN)</h3>
          <p className="text-sm text-slate-500">Net rental income calculated strictly from expenses with verified receipts.</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label mb-1">Viewing as owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="input cursor-pointer font-semibold text-primary">
              {statements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.icNumber ?? "IC —"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1">
              <i className="fa-regular fa-calendar mr-1" /> Filter by year
            </label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input cursor-pointer">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button onClick={exportPdf} disabled={exporting || !yr} className="btn-primary">
            <i className="fa-solid fa-file-pdf" /> {exporting ? "Generating…" : "Export e-Filing PDF"}
          </button>
        </div>
      </div>

      {!owner || !yr ? (
        <div className="card p-12 text-center text-slate-500">No owner statements available.</div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-3">
              <h4 className="text-2xl font-black text-slate-900">Tax Year: {yr.year}</h4>
              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">Jan 1 – Dec 31</span>
            </div>
            <div className="relative w-full sm:w-72">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by property name…"
                className="input pl-11"
              />
            </div>
          </div>

          {/* Summary banner */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 to-primary p-8 text-white shadow-md">
            <i className="fa-solid fa-calculator absolute -right-10 -top-10 text-9xl text-white opacity-5" />
            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-blue-200">Total Net Taxable Rental Income ({yr.year})</p>
                <h2 className="mt-1 text-5xl font-black">{formatMYR(yr.totalNet)}</h2>
                <p className="mt-3 flex items-center gap-2 text-xs text-blue-300">
                  <i className="fa-solid fa-shield-check text-lg text-green-400" />
                  Ready for Form BE (Part C). Expenses verified via CRM receipt audit trail.
                </p>
              </div>
              <div className="border-t border-blue-700/50 pt-4 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                <p className="text-xs font-semibold uppercase text-blue-200">Beneficiary</p>
                <p className="mt-1 text-xl font-bold">{owner.name}</p>
                <p className="mt-1 inline-block rounded bg-blue-900/50 px-2 py-1 text-xs text-blue-300">
                  <i className="fa-solid fa-lock mr-1 text-[10px]" /> Access restricted
                </p>
              </div>
            </div>
          </div>

          {/* Per-property cards */}
          {filteredProperties.length === 0 ? (
            <div className="card p-10 text-center text-slate-400">
              {query
                ? `No properties match “${query}” for ${yr.year}.`
                : `No properties with recorded income for ${yr.year}. Rent collected (paid) under Rental Collection is recorded automatically; you can also use the Edit button on a property to enter a manual rental collection amount.`}
            </div>
          ) : (
            filteredProperties.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <div>
                    <h5 className="text-lg font-bold text-slate-900">{p.name}</h5>
                    <p className={cx("text-sm font-medium", p.sharePercent === 100 ? "text-primary" : "text-accent")}>
                      <i className="fa-solid fa-chart-pie mr-1" />
                      {p.sharePercent}% ownership {p.sharePercent < 100 ? "(Joint Venture)" : ""}
                    </p>
                  </div>
                  <button onClick={() => setEditing({ property: p, year: yr.year })} className="btn-ghost !px-3 !py-1.5 text-xs">
                    <i className="fa-solid fa-pen" /> Edit
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-600">Gross rental collection</span>
                        <span className="font-bold text-slate-900">{formatMYR(p.gross)}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                        <span><i className="fa-solid fa-hand-holding-dollar mr-1" /> Collected {formatMYR(p.grossCollected)}</span>
                        {p.manualRent > 0 && <span><i className="fa-solid fa-plus mr-1" /> Manual {formatMYR(p.manualRent)}</span>}
                        {p.billExpenses > 0 && <span><i className="fa-solid fa-receipt mr-1" /> Bills {formatMYR(p.billExpenses)}</span>}
                      </div>
                    </div>
                    <div className="space-y-2 border-l-2 border-red-200 py-1 pl-4">
                      {p.expenseItems.map((e) => (
                        <div key={e.id} className="flex justify-between gap-2 text-sm text-slate-500">
                          <span className="min-w-0 truncate">(−) {e.description}</span>
                          <span className="shrink-0 font-medium text-red-500">− {formatMYR(e.amount)}</span>
                        </div>
                      ))}
                      {p.expenseItems.length === 0 && (
                        <p className="text-xs text-slate-400">No expenses this year — paid bills from Bills &amp; Utilities are totaled automatically.</p>
                      )}
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-3 text-sm">
                      <span className="font-bold text-slate-700">Net property income (before split)</span>
                      <span className="text-lg font-bold text-slate-900">{formatMYR(p.net)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Income split distribution</p>
                      <div className="relative overflow-hidden rounded-lg border-2 border-blue-500 bg-white p-3">
                        <div className="absolute inset-y-0 left-0 w-1 bg-blue-500" />
                        <div className="flex items-center justify-between pl-3 text-sm">
                          <span className="font-bold text-blue-800">{owner.name} ({p.sharePercent}%)</span>
                          <span className="text-lg font-black text-blue-700">{formatMYR(p.share)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Uploaded receipts (from bill payments) — downloadable */}
                    {p.receipts.length > 0 && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-600">
                          <i className="fa-solid fa-receipt mr-1" /> Payment receipts ({yr.year})
                        </p>
                        <ul className="space-y-1.5">
                          {p.receipts.map((r) => (
                            <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-slate-600">{r.label}</span>
                              {r.url ? (
                                <a href={r.url} download target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
                                  <i className="fa-solid fa-download" /> Download
                                </a>
                              ) : (
                                <span className="text-slate-400">no file</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {editing && (
        <EditPropertyModal
          property={editing.property}
          year={editing.year}
          ownerName={owner?.name ?? ""}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {/* Audit trail */}
      <div className="card">
        <div className="border-b border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            <i className="fa-solid fa-clock-rotate-left mr-2 text-primary" /> Chronological Audit Trail
          </h3>
          <p className="text-sm text-slate-500">Every income and expenditure event linked to supporting evidence.</p>
        </div>
        <ol className="divide-y divide-slate-100">
          {auditLogs.map((log) => (
            <li key={log.id} className="flex items-start gap-4 px-6 py-3.5">
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                <i className="fa-solid fa-link" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {log.action.replace("_", " ")} · {log.entityType}
                </p>
                <p className="text-xs text-slate-500">
                  {log.description}
                  {log.userName ? <span className="ml-1 font-medium text-slate-600">· by {log.userName}</span> : null}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-slate-400">{formatDate(log.createdAt)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Corrections modal: adjust gross rental collection + add/remove expenses. */
function EditPropertyModal({
  property,
  year,
  ownerName,
  onClose,
  onSaved,
}: {
  property: TaxProperty;
  year: number;
  ownerName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [manualRent, setManualRent] = useState(property.manualRent ? String(property.manualRent) : "");
  const [cat, setCat] = useState("Maintenance");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch("/api/tax/property", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: property.id, year, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Failed to save.");
  }

  async function saveManualRent() {
    setSaving(true);
    setError(null);
    try {
      await patch({ manualRent: Number(manualRent || 0) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the manual rental collection.");
      setSaving(false);
    }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (!desc.trim() || !amount) {
      setError("Description and amount are required for an expense.");
      setSaving(false);
      return;
    }
    try {
      await patch({
        expense: {
          category: cat,
          description: desc.trim(),
          amount: Number(amount),
          incurredAt: date || `${year}-01-01`,
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add expense.");
      setSaving(false);
    }
  }

  async function removeExpense(id: string) {
    setSaving(true);
    setError(null);
    try {
      await patch({ deleteExpenseId: id });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove expense.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="card max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">Edit Property — {property.name}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        <div className="grid gap-5 p-6">
          <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
            Correcting tax figures for <span className="font-semibold text-slate-700">{ownerName}</span> · {year}. All changes are
            written to the audit trail for LHDN readiness.
          </div>

          {/* Manual additional rental collection */}
          <div>
            <label className="label mb-1">Additional manual rental collection (RM) — {year}</label>
            <div className="flex gap-2">
              <input type="number" value={manualRent} onChange={(e) => setManualRent(e.target.value)} className="input" placeholder="0.00" />
              <button type="button" onClick={saveManualRent} disabled={saving} className="btn-primary shrink-0">
                <i className="fa-solid fa-floppy-disk" /> Save
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Adds to the auto-collected rent under Rental Collection (e.g. rent received before the lease started) to form the gross rental collection for {year}.
            </p>
          </div>

          {/* Manual expense list */}
          <div>
            <label className="label mb-2">Additional recorded expenses</label>
            {property.manualExpenseItems.length === 0 ? (
              <p className="text-xs italic text-slate-400">No additional expenses recorded for {year}.</p>
            ) : (
              <ul className="space-y-2">
                {property.manualExpenseItems.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-slate-700">{e.description}</p>
                      <p className="text-xs text-slate-400">{e.category}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-bold text-red-500">− {formatMYR(e.amount)}</span>
                      <button type="button" onClick={() => removeExpense(e.id)} disabled={saving} className="grid h-7 w-7 place-items-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                        <i className="fa-solid fa-trash-can text-xs" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="rounded-xl bg-blue-50/60 p-3 text-[11px] leading-relaxed text-blue-700">
            <i className="fa-solid fa-circle-info mr-1" />
            Paid bills from Bills &amp; Utilities are already totaled into expenses automatically — this form only manages additional expenses.
          </p>

          {/* Add expense */}
          <form onSubmit={addExpense} className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Add additional expense</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label mb-1">Category</label>
                <select value={cat} onChange={(e) => setCat(e.target.value)} className="input cursor-pointer">
                  <option>Maintenance</option>
                  <option>Repairs</option>
                  <option>Management Fee</option>
                  <option>Quit Rent</option>
                  <option>Assessment Tax</option>
                  <option>Sewerage</option>
                  <option>Insurance</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="label mb-1">Amount (RM)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0.00" />
              </div>
              <div className="sm:col-span-2">
                <label className="label mb-1">Description</label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} className="input" placeholder="e.g. Annual maintenance & management fees" />
              </div>
              <div className="sm:col-span-2">
                <label className="label mb-1">Incurred date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input cursor-pointer" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary mt-4 w-full justify-center">
              <i className="fa-solid fa-plus" /> Add expense
            </button>
          </form>
        </div>

        {error && <p className="px-6 pb-2 text-sm font-medium text-red-500">{error}</p>}

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
}
