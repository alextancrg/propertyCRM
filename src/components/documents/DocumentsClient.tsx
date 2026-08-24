"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cx, formatDate } from "@/lib/format";

type DocDTO = {
  id: string;
  title: string;
  category: string;
  isStamped: boolean;
  fileUrl: string | null;
  year: number;
  leaseFrom: string | null; // "YYYY-MM-DD" — lease tenure start
  leaseTo: string | null; // "YYYY-MM-DD", or null = open-ended (until further notice)
  uploadedAt: string;
  propertyId: string | null;
  property: string | null;
  tenantId: string | null;
  tenant: string | null;
};

const CATEGORY_ICON: Record<string, { icon: string; cls: string }> = {
  "Lease Agreement": { icon: "fa-file-signature", cls: "bg-purple-100 text-purple-600" },
  Receipt: { icon: "fa-receipt", cls: "bg-emerald-100 text-emerald-600" },
  Insurance: { icon: "fa-shield", cls: "bg-amber-100 text-amber-600" },
  Warranty: { icon: "fa-certificate", cls: "bg-sky-100 text-sky-600" },
  Title: { icon: "fa-landmark", cls: "bg-blue-100 text-blue-600" },
  Compliance: { icon: "fa-scale-balanced", cls: "bg-rose-100 text-rose-600" },
};

/**
 * Whether a document sits within the given search year, based on its lease
 * tenure (lease start → lease end). Open-ended leases (null end date, i.e.
 * "until further notice") always match — they must appear in every year's
 * search results.
 */
function docInYear(d: DocDTO, year: number): boolean {
  // Legacy docs (filed by year, no lease dates) → single-year tenure.
  if (d.leaseFrom === null && d.leaseTo === null) {
    return d.year === year;
  }
  // Open-ended lease (has a start date, no end date) → always matches any year.
  if (d.leaseTo === null) return true;
  const fromY = d.leaseFrom ? Number(d.leaseFrom.slice(0, 4)) : d.year;
  const toY = Number(d.leaseTo.slice(0, 4));
  return fromY <= year && year <= toY;
}

function tenureLabel(d: DocDTO): string | null {
  if (!d.leaseFrom) return null;
  const from = formatDate(new Date(`${d.leaseFrom}T00:00:00`));
  if (d.leaseTo === null) return `${from} – Open (until further notice)`;
  const to = formatDate(new Date(`${d.leaseTo}T00:00:00`));
  return `${from} – ${to}`;
}

export function DocumentsClient({
  documents,
  properties,
  tenants,
}: {
  documents: DocDTO[];
  properties: { id: string; name: string }[];
  tenants: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocDTO | null>(null);

  const categories = useMemo(() => Array.from(new Set(documents.map((d) => d.category))), [documents]);
  // Year options come from lease tenure years plus the current year.
  const yearOptions = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    documents.forEach((d) => {
      if (d.leaseFrom) set.add(Number(d.leaseFrom.slice(0, 4)));
      if (d.leaseTo) set.add(Number(d.leaseTo.slice(0, 4)));
      set.add(d.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [documents]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return documents.filter((d) => {
      const matchQ = !q || d.title.toLowerCase().includes(q) || (d.property ?? "").toLowerCase().includes(q);
      const matchC = catFilter === "All" || d.category === catFilter;
      const matchY = yearFilter === "all" || docInYear(d, Number(yearFilter));
      return matchQ && matchC && matchY;
    });
  }, [documents, query, catFilter, yearFilter]);

  // Group by lease start year (descending), then by upload date (descending).
  const grouped = useMemo(() => {
    const byYear = new Map<number, DocDTO[]>();
    [...filtered]
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .forEach((d) => {
        const g = d.leaseFrom ? Number(d.leaseFrom.slice(0, 4)) : d.year;
        const arr = byYear.get(g) ?? [];
        arr.push(d);
        byYear.set(g, arr);
      });
    return Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Document Vault</h3>
          <p className="text-sm text-slate-500">Secure system of record for leases, receipts, insurance, titles and warranties.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary self-start sm:self-auto">
          <i className="fa-solid fa-file-arrow-up" /> Upload Document
        </button>
      </div>

      {/* Search + year + category filter */}
      <div className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" className="input pl-11" />
        </div>
        <div className="relative md:w-48">
          <i className="fa-regular fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="input pl-9 cursor-pointer">
            <option value="all">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="relative md:w-56">
          <i className="fa-solid fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input pl-9 cursor-pointer">
            <option>All</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grouped by year */}
      {grouped.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <i className="fa-solid fa-folder-open mb-3 text-4xl text-slate-300" />
          <p className="text-lg font-medium">No documents found.</p>
        </div>
      ) : (
        grouped.map(([year, docs]) => (
          <div key={year} className="space-y-3">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-black text-slate-800">{year}</h4>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">{docs.length} docs</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="card overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {docs.map((d) => {
                  const meta = CATEGORY_ICON[d.category] ?? { icon: "fa-file", cls: "bg-slate-100 text-slate-500" };
                  return (
                    <li key={d.id} className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50">
                      <div className={cx("grid h-11 w-11 place-items-center rounded-xl", meta.cls)}>
                        <i className={`fa-solid ${meta.icon}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{d.title}</p>
                          {d.isStamped && (
                            <span className="pill bg-green-100 text-green-700">
                              <i className="fa-solid fa-stamp" /> Stamped
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {d.category}
                          {d.property ? ` · ${d.property}` : ""}
                          {d.tenant ? ` · ${d.tenant}` : ""}
                        </p>
                        {d.leaseFrom && (
                          <p className="mt-0.5 text-[11px] font-medium text-primary/80">
                            <i className="fa-solid fa-calendar mr-1" />
                            Lease: {tenureLabel(d)}
                          </p>
                        )}
                      </div>
                      <span className="hidden shrink-0 text-xs font-medium text-slate-400 sm:block">{formatDate(d.uploadedAt)}</span>
                      <button
                        onClick={() => setEditing(d)}
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                        title="Update lease dates / details"
                      >
                        <i className="fa-solid fa-pen" /> Edit
                      </button>
                      {d.fileUrl ? (
                        <a
                          href={d.fileUrl}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost !px-3 !py-1.5 text-xs"
                          title="Click to download"
                        >
                          <i className="fa-solid fa-download" /> Download
                        </a>
                      ) : (
                        <span className="rounded-lg border border-dashed border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400">
                          No file
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))
      )}

      {(showModal || editing) && (
        <UploadModal
          doc={editing}
          properties={properties}
          tenants={tenants}
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
    </div>
  );
}

function UploadModal({
  doc,
  properties,
  tenants,
  onClose,
  onSaved,
}: {
  doc: DocDTO | null;
  properties: { id: string; name: string }[];
  tenants: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(doc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Open-ended = no end date (until further notice). Default for new docs is
  // unchecked so the PM explicitly ticks it when the end date is unknown.
  const [openEnded, setOpenEnded] = useState(doc ? doc.leaseTo === null : false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      if (openEnded) fd.set("leaseTo", "");
      fd.set("openEnded", openEnded ? "true" : "false");
      // Always send the stamp flag so it can be toggled off when editing.
      fd.set("isStamped", fd.get("isStamped") === "true" ? "true" : "false");
      const url = isEdit ? `/api/documents/${doc!.id}` : "/api/documents";
      const res = await fetch(url, { method: isEdit ? "PATCH" : "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not save the document.");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the document. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">{isEdit ? "Edit Document" : "Upload Document"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>
        <div className="grid gap-4 p-6">
          <div>
            <label className="label mb-1">Title</label>
            <input name="title" className="input" placeholder="e.g. Tenancy Agreement — Apt 4B" defaultValue={doc?.title ?? ""} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1">Category</label>
              <select name="category" className="input cursor-pointer" defaultValue={doc?.category ?? ""}>
                <option value="" disabled>Select category</option>
                <option>Lease Agreement</option>
                <option>Receipt</option>
                <option>Insurance</option>
                <option>Warranty</option>
                <option>Title</option>
                <option>Compliance</option>
              </select>
            </div>
            <div>
              <label className="label mb-1">Property</label>
              <select name="propertyId" className="input cursor-pointer" defaultValue={doc?.propertyId ?? ""}>
                <option value="">— None —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1">Tenant</label>
              <select name="tenantId" className="input cursor-pointer" defaultValue={doc?.tenantId ?? ""}>
                <option value="">— None —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1">Lease from date</label>
              <input name="leaseFrom" type="date" defaultValue={doc?.leaseFrom ?? undefined} className="input cursor-pointer" />
            </div>
            <div>
              <label className="label mb-1">Lease to date</label>
              <input
                name="leaseTo"
                type="date"
                disabled={openEnded}
                defaultValue={doc?.leaseTo ?? undefined}
                className="input cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              />
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={openEnded}
                  onChange={(e) => setOpenEnded(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>Lease is infinite — until further notice (no end date)</span>
              </label>
            </div>
            <div className="col-span-2">
              <label className="label mb-1">{isEdit ? "Replace file (optional)" : "File"}</label>
              <input name="file" type="file" className="input file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold" />
            </div>
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <i className="fa-solid fa-circle-info mr-1" />
            {isEdit
              ? "If the lease end date wasn't confirmed when this document was filed, update it here once the end date is determined."
              : "Lease end date not determined yet? Tick “Lease is infinite” and file the document. When the end date is later confirmed, use Edit on the document to update it."}
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="isStamped"
              value="true"
              defaultChecked={doc?.isStamped ?? false}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Legally stamped / legalized (e.g. LHDN)
          </label>
        </div>
        {error && <p className="px-6 pb-2 text-sm font-medium text-red-500">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : isEdit ? "Save changes" : "Upload"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
